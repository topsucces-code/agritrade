import axios, { AxiosInstance } from 'axios';
import { cache } from '../config/redis';
import { serviceCircuitBreakers } from '../middleware/circuitBreaker';

// Interface definitions for API responses
interface WeatherData {
  current: {
    temperature: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    windDirection: number;
    visibility: number;
    uvIndex: number;
    description: string;
    icon: string;
  };
  forecast: Array<{
    date: string;
    temperature: { min: number; max: number };
    humidity: number;
    precipitation: number;
    windSpeed: number;
    description: string;
    icon: string;
  }>;
  alerts?: Array<{
    type: string;
    severity: string;
    description: string;
    start: string;
    end: string;
  }>;
}

interface NASAPowerData {
  solarRadiation: number;
  precipitation: number;
  temperature: { min: number; max: number };
  humidity: number;
  windSpeed: number;
  date: string;
  location: { latitude: number; longitude: number };
}

interface FAOMarketData {
  commodity: string;
  country: string;
  price: number;
  currency: string;
  unit: string;
  date: string;
  source: string;
  marketTrend: 'rising' | 'falling' | 'stable';
  changePercent: number;
}

interface GeocodeResult {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  region: string;
  country: string;
  postalCode?: string;
  confidence: number;
}

interface RouteData {
  distance: number; // in kilometers
  duration: number; // in minutes
  geometry: any; // GeoJSON LineString
  steps: Array<{
    instruction: string;
    distance: number;
    duration: number;
  }>;
}

/**
 * External API Service for weather, agricultural data, and mapping services
 */
export class ExternalAPIService {
  private weatherApiKey: string;
  private nasaPowerApiKey: string;
  private mapboxApiKey: string;
  private faoApiKey: string;
  
  private weatherApi: AxiosInstance;
  private nasaApi: AxiosInstance;
  private mapboxApi: AxiosInstance;
  private faoApi: AxiosInstance;

  constructor() {
    // Initialize API keys from environment variables
    this.weatherApiKey = process.env.OPENWEATHER_API_KEY || '';
    this.nasaPowerApiKey = process.env.NASA_POWER_API_KEY || '';
    this.mapboxApiKey = process.env.MAPBOX_API_KEY || '';
    this.faoApiKey = process.env.FAO_API_KEY || '';

    // Initialize axios instances with base configurations
    this.weatherApi = axios.create({
      baseURL: 'https://api.openweathermap.org/data/2.5',
      timeout: 10000,
      params: {
        appid: this.weatherApiKey,
        units: 'metric'
      }
    });

    this.nasaApi = axios.create({
      baseURL: 'https://power.larc.nasa.gov/api/temporal',
      timeout: 15000
    });

    this.mapboxApi = axios.create({
      baseURL: 'https://api.mapbox.com',
      timeout: 10000,
      params: {
        access_token: this.mapboxApiKey
      }
    });

    this.faoApi = axios.create({
      baseURL: 'https://www.fao.org/giews/food-prices/api',
      timeout: 10000
    });

    this.setupInterceptors();
  }

  /**
   * Setup request/response interceptors for logging and error handling
   */
  private setupInterceptors(): void {
    // Weather API interceptors
    this.weatherApi.interceptors.request.use(
      config => {
        console.log(`🌤️ Weather API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      error => Promise.reject(error)
    );

    this.weatherApi.interceptors.response.use(
      response => response,
      error => {
        console.error('🌤️ Weather API Error:', error.response?.status, error.message);
        return Promise.reject(error);
      }
    );

    // NASA POWER API interceptors
    this.nasaApi.interceptors.request.use(
      config => {
        console.log(`🛰️ NASA POWER API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      }
    );

    // Mapbox API interceptors
    this.mapboxApi.interceptors.request.use(
      config => {
        console.log(`🗺️ Mapbox API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      }
    );
  }

  /**
   * Get current weather data for a location
   */
  async getCurrentWeather(
    latitude: number, 
    longitude: number,
    useCache: boolean = true
  ): Promise<WeatherData> {
    const cacheKey = `weather:current:${latitude}:${longitude}`;
    
    if (useCache) {
      const cached = await cache.getJSON<WeatherData>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    return serviceCircuitBreakers.openWeather.execute(async () => {
      const [currentResponse, forecastResponse] = await Promise.all([
        this.weatherApi.get('/weather', {
          params: { lat: latitude, lon: longitude }
        }),
        this.weatherApi.get('/forecast', {
          params: { lat: latitude, lon: longitude, cnt: 5 }
        })
      ]);

      const current = currentResponse.data;
      const forecast = forecastResponse.data.list.map((item: any) => ({
        date: new Date(item.dt * 1000).toISOString(),
        temperature: {
          min: item.main.temp_min,
          max: item.main.temp_max
        },
        humidity: item.main.humidity,
        precipitation: item.rain?.['3h'] || 0,
        windSpeed: item.wind.speed,
        description: item.weather[0].description,
        icon: item.weather[0].icon
      }));

      const weatherData: WeatherData = {
        current: {
          temperature: current.main.temp,
          humidity: current.main.humidity,
          pressure: current.main.pressure,
          windSpeed: current.wind.speed,
          windDirection: current.wind.deg,
          visibility: current.visibility / 1000, // Convert to km
          uvIndex: 0, // Would need separate UV API call
          description: current.weather[0].description,
          icon: current.weather[0].icon
        },
        forecast
      };

      // Cache for 30 minutes
      await cache.setJSON(cacheKey, weatherData, 1800);
      
      return weatherData;
    });
  }

  /**
   * Get weather alerts for a location
   */
  async getWeatherAlerts(
    latitude: number, 
    longitude: number
  ): Promise<WeatherData['alerts']> {
    const cacheKey = `weather:alerts:${latitude}:${longitude}`;
    
    const cached = await cache.getJSON<WeatherData['alerts']>(cacheKey);
    if (cached) {
      return cached;
    }

    return serviceCircuitBreakers.openWeather.execute(async () => {
      try {
        const response = await this.weatherApi.get('/onecall', {
          params: { 
            lat: latitude, 
            lon: longitude,
            exclude: 'minutely,hourly,daily'
          }
        });

        const alerts = response.data.alerts?.map((alert: any) => ({
          type: alert.event,
          severity: this.mapWeatherSeverity(alert.tags),
          description: alert.description,
          start: new Date(alert.start * 1000).toISOString(),
          end: new Date(alert.end * 1000).toISOString()
        })) || [];

        // Cache for 15 minutes
        await cache.setJSON(cacheKey, alerts, 900);
        
        return alerts;
      } catch (error) {
        // If one-call API is not available, return empty alerts
        console.warn('Weather alerts not available:', error);
        return [];
      }
    });
  }

  /**
   * Get NASA POWER agricultural data
   */
  async getNASAPowerData(
    latitude: number,
    longitude: number,
    startDate: string,
    endDate: string
  ): Promise<NASAPowerData[]> {
    const cacheKey = `nasa:power:${latitude}:${longitude}:${startDate}:${endDate}`;
    
    const cached = await cache.getJSON<NASAPowerData[]>(cacheKey);
    if (cached) {
      return cached;
    }

    return serviceCircuitBreakers.nasaPower.execute(async () => {
      const response = await this.nasaApi.get('/daily/point', {
        params: {
          parameters: 'ALLSKY_SFC_SW_DWN,PRECTOTCORR,T2M_MIN,T2M_MAX,RH2M,WS2M',
          community: 'AG',
          longitude: longitude,
          latitude: latitude,
          start: startDate.replace(/-/g, ''),
          end: endDate.replace(/-/g, ''),
          format: 'JSON'
        }
      });

      const data = response.data.properties.parameter;
      const dates = Object.keys(data.ALLSKY_SFC_SW_DWN);
      
      const powerData: NASAPowerData[] = dates.map(date => ({
        solarRadiation: data.ALLSKY_SFC_SW_DWN[date],
        precipitation: data.PRECTOTCORR[date],
        temperature: {
          min: data.T2M_MIN[date],
          max: data.T2M_MAX[date]
        },
        humidity: data.RH2M[date],
        windSpeed: data.WS2M[date],
        date: this.formatNASADate(date),
        location: { latitude, longitude }
      }));

      // Cache for 6 hours
      await cache.setJSON(cacheKey, powerData, 21600);
      
      return powerData;
    });
  }

  /**
   * Get FAO GIEWS market prices
   */
  async getFAOMarketData(
    commodity: string,
    country: string,
    months: number = 12
  ): Promise<FAOMarketData[]> {
    const cacheKey = `fao:market:${commodity}:${country}:${months}`;
    
    const cached = await cache.getJSON<FAOMarketData[]>(cacheKey);
    if (cached) {
      return cached;
    }

    return serviceCircuitBreakers.faoGiews.execute(async () => {
      try {
        // FAO GIEWS API simulation - in real implementation, use actual API
        const response = await this.faoApi.get('/food-prices', {
          params: {
            commodity: commodity.toLowerCase(),
            country: country.toLowerCase(),
            months: months
          }
        });

        const marketData: FAOMarketData[] = response.data.map((item: any) => ({
          commodity,
          country,
          price: item.price,
          currency: item.currency || 'USD',
          unit: item.unit || 'MT',
          date: item.date,
          source: 'FAO GIEWS',
          marketTrend: this.calculateTrend(item.trend),
          changePercent: item.changePercent || 0
        }));

        // Cache for 4 hours
        await cache.setJSON(cacheKey, marketData, 14400);
        
        return marketData;
      } catch (error) {
        // Fallback with simulated data
        console.warn('FAO API not available, using fallback data');
        return this.getFallbackMarketData(commodity, country, months);
      }
    });
  }

  /**
   * Geocode an address using Mapbox
   */
  async geocodeAddress(address: string): Promise<GeocodeResult[]> {
    const cacheKey = `geocode:${encodeURIComponent(address)}`;
    
    const cached = await cache.getJSON<GeocodeResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    return serviceCircuitBreakers.mapbox.execute(async () => {
      const response = await this.mapboxApi.get('/geocoding/v5/mapbox.places/' + encodeURIComponent(address) + '.json', {
        params: {
          country: 'GH,NG,CI,BF,ML,SN', // West African countries
          types: 'place,locality,address',
          limit: 5
        }
      });

      const results: GeocodeResult[] = response.data.features.map((feature: any) => ({
        latitude: feature.center[1],
        longitude: feature.center[0],
        address: feature.place_name,
        city: this.extractPlaceComponent(feature, 'place') || '',
        region: this.extractPlaceComponent(feature, 'region') || '',
        country: this.extractPlaceComponent(feature, 'country') || '',
        postalCode: this.extractPlaceComponent(feature, 'postcode'),
        confidence: feature.relevance
      }));

      // Cache for 24 hours
      await cache.setJSON(cacheKey, results, 86400);
      
      return results;
    });
  }

  /**
   * Get route between two points using Mapbox
   */
  async getRoute(
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    profile: 'driving' | 'walking' | 'cycling' = 'driving'
  ): Promise<RouteData> {
    const cacheKey = `route:${startLat}:${startLon}:${endLat}:${endLon}:${profile}`;
    
    const cached = await cache.getJSON<RouteData>(cacheKey);
    if (cached) {
      return cached;
    }

    return serviceCircuitBreakers.mapbox.execute(async () => {
      const coordinates = `${startLon},${startLat};${endLon},${endLat}`;
      
      const response = await this.mapboxApi.get(`/directions/v5/mapbox/${profile}/${coordinates}`, {
        params: {
          geometries: 'geojson',
          steps: true,
          overview: 'full'
        }
      });

      const route = response.data.routes[0];
      
      const routeData: RouteData = {
        distance: route.distance / 1000, // Convert to km
        duration: route.duration / 60, // Convert to minutes
        geometry: route.geometry,
        steps: route.legs[0].steps.map((step: any) => ({
          instruction: step.maneuver.instruction,
          distance: step.distance,
          duration: step.duration / 60
        }))
      };

      // Cache for 2 hours
      await cache.setJSON(cacheKey, routeData, 7200);
      
      return routeData;
    });
  }

  /**
   * Get historical weather data for agricultural analysis
   */
  async getHistoricalWeather(
    latitude: number,
    longitude: number,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const cacheKey = `weather:historical:${latitude}:${longitude}:${startDate.toISOString()}:${endDate.toISOString()}`;
    
    const cached = await cache.getJSON<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Use NASA POWER for historical data since OpenWeather historical requires subscription
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    
    return this.getNASAPowerData(latitude, longitude, start, end);
  }

  /**
   * Get crop suitability data from multiple sources
   */
  async getCropSuitabilityData(
    latitude: number,
    longitude: number,
    cropType: string
  ): Promise<any> {
    const cacheKey = `crop:suitability:${latitude}:${longitude}:${cropType}`;
    
    const cached = await cache.getJSON<any>(cacheKey);
    if (cached) {
      return cached;
    }

    return serviceCircuitBreakers.nasaPower.execute(async () => {
      // Get current year's data
      const currentYear = new Date().getFullYear();
      const startDate = `${currentYear}-01-01`;
      const endDate = `${currentYear}-12-31`;
      
      const [weatherData, nasaData] = await Promise.all([
        this.getCurrentWeather(latitude, longitude),
        this.getNASAPowerData(latitude, longitude, startDate, endDate)
      ]);

      const suitabilityData = {
        location: { latitude, longitude },
        cropType,
        currentConditions: weatherData.current,
        yearlyAverages: this.calculateYearlyAverages(nasaData),
        suitabilityScore: this.calculateCropSuitability(cropType, weatherData, nasaData),
        recommendations: this.generateCropRecommendations(cropType, weatherData, nasaData),
        riskFactors: this.identifyRiskFactors(weatherData, nasaData)
      };

      // Cache for 12 hours
      await cache.setJSON(cacheKey, suitabilityData, 43200);
      
      return suitabilityData;
    });
  }

  // Private helper methods

  private mapWeatherSeverity(tags: string[]): string {
    if (tags.includes('Extreme')) return 'extreme';
    if (tags.includes('Severe')) return 'severe';
    if (tags.includes('Moderate')) return 'moderate';
    return 'minor';
  }

  private formatNASADate(nasaDate: string): string {
    // Convert YYYYMMDD to YYYY-MM-DD
    return `${nasaDate.substring(0, 4)}-${nasaDate.substring(4, 6)}-${nasaDate.substring(6, 8)}`;
  }

  private calculateTrend(trendValue: number): 'rising' | 'falling' | 'stable' {
    if (trendValue > 5) return 'rising';
    if (trendValue < -5) return 'falling';
    return 'stable';
  }

  private extractPlaceComponent(feature: any, type: string): string | undefined {
    return feature.context?.find((ctx: any) => ctx.id.startsWith(type))?.text;
  }

  private calculateYearlyAverages(nasaData: NASAPowerData[]): any {
    if (nasaData.length === 0) return {};

    const totals = nasaData.reduce((acc, day) => ({
      solarRadiation: acc.solarRadiation + day.solarRadiation,
      precipitation: acc.precipitation + day.precipitation,
      temperature: acc.temperature + (day.temperature.min + day.temperature.max) / 2,
      humidity: acc.humidity + day.humidity,
      windSpeed: acc.windSpeed + day.windSpeed
    }), { solarRadiation: 0, precipitation: 0, temperature: 0, humidity: 0, windSpeed: 0 });

    const count = nasaData.length;
    return {
      avgSolarRadiation: totals.solarRadiation / count,
      avgPrecipitation: totals.precipitation / count,
      avgTemperature: totals.temperature / count,
      avgHumidity: totals.humidity / count,
      avgWindSpeed: totals.windSpeed / count,
      totalPrecipitation: totals.precipitation
    };
  }

  private calculateCropSuitability(
    cropType: string, 
    weatherData: WeatherData, 
    nasaData: NASAPowerData[]
  ): number {
    // Simplified crop suitability calculation
    const averages = this.calculateYearlyAverages(nasaData);
    let score = 50; // Base score

    // Temperature suitability (varies by crop)
    const cropTempRanges: { [key: string]: { min: number; max: number } } = {
      cocoa: { min: 18, max: 32 },
      coffee: { min: 15, max: 28 },
      cotton: { min: 20, max: 35 },
      maize: { min: 16, max: 35 }
    };

    const tempRange = cropTempRanges[cropType.toLowerCase()] || { min: 15, max: 35 };
    if (averages.avgTemperature >= tempRange.min && averages.avgTemperature <= tempRange.max) {
      score += 20;
    } else {
      score -= Math.abs(averages.avgTemperature - (tempRange.min + tempRange.max) / 2) * 2;
    }

    // Precipitation suitability
    if (averages.totalPrecipitation >= 1000 && averages.totalPrecipitation <= 2500) {
      score += 15;
    } else {
      score -= Math.abs(averages.totalPrecipitation - 1500) / 100;
    }

    // Humidity suitability
    if (averages.avgHumidity >= 60 && averages.avgHumidity <= 80) {
      score += 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private generateCropRecommendations(
    cropType: string,
    weatherData: WeatherData,
    nasaData: NASAPowerData[]
  ): string[] {
    const recommendations: string[] = [];
    const averages = this.calculateYearlyAverages(nasaData);

    if (averages.avgTemperature > 32) {
      recommendations.push('Consider heat-resistant varieties due to high temperatures');
    }

    if (averages.totalPrecipitation < 800) {
      recommendations.push('Irrigation recommended due to low rainfall');
    }

    if (averages.avgHumidity > 85) {
      recommendations.push('Monitor for fungal diseases due to high humidity');
    }

    return recommendations;
  }

  private identifyRiskFactors(weatherData: WeatherData, nasaData: NASAPowerData[]): string[] {
    const risks: string[] = [];
    
    if (weatherData.alerts && weatherData.alerts.length > 0) {
      risks.push('Active weather alerts in the area');
    }

    const averages = this.calculateYearlyAverages(nasaData);
    
    if (averages.avgTemperature > 35) {
      risks.push('Extreme heat risk');
    }

    if (averages.totalPrecipitation < 500) {
      risks.push('Drought risk');
    }

    if (averages.totalPrecipitation > 3000) {
      risks.push('Flood risk');
    }

    return risks;
  }

  private async getFallbackMarketData(
    commodity: string,
    country: string,
    months: number
  ): Promise<FAOMarketData[]> {
    // Simulated fallback data for development
    const data: FAOMarketData[] = [];
    const basePrice = this.getBasePriceForCommodity(commodity);
    
    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      const randomVariation = (Math.random() - 0.5) * 0.2; // ±10% variation
      const price = basePrice * (1 + randomVariation);
      
      data.push({
        commodity,
        country,
        price: Math.round(price * 100) / 100,
        currency: 'USD',
        unit: 'MT',
        date: date.toISOString().split('T')[0],
        source: 'Simulated Data',
        marketTrend: Math.random() > 0.6 ? 'rising' : Math.random() > 0.3 ? 'stable' : 'falling',
        changePercent: Math.round((Math.random() - 0.5) * 20 * 100) / 100
      });
    }

    return data.reverse(); // Chronological order
  }

  private getBasePriceForCommodity(commodity: string): number {
    const basePrices: { [key: string]: number } = {
      cocoa: 2500,
      coffee: 3000,
      cotton: 1800,
      maize: 200,
      rice: 400,
      peanuts: 1200
    };

    return basePrices[commodity.toLowerCase()] || 1000;
  }
}

export default ExternalAPIService;