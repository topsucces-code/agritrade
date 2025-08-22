// AgriTrade AI - Google Vision API Integration
// Estimation automatique de la qualité des produits agricoles

const vision = require('@google-cloud/vision');
const sharp = require('sharp');
const AWS = require('aws-sdk');

/**
 * Service d'analyse de qualité des produits agricoles via Google Vision API
 * Spécialisé pour l'analyse de cacao, café, et autres commodités
 */
class ProductQualityAnalyzer {
  constructor() {
    // Configuration Google Cloud Vision
    this.visionClient = new vision.ImageAnnotatorClient({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_CLOUD_KEYFILE
    });

    // Configuration AWS S3 pour stockage images
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });

    // Seuils de qualité par type de produit
    this.qualityThresholds = {
      cocoa: {
        excellent: { minScore: 90, grade: 'A+', priceMultiplier: 1.2 },
        good: { minScore: 75, grade: 'A', priceMultiplier: 1.1 },
        average: { minScore: 60, grade: 'B', priceMultiplier: 1.0 },
        poor: { minScore: 40, grade: 'C', priceMultiplier: 0.8 },
        rejected: { minScore: 0, grade: 'D', priceMultiplier: 0.6 }
      },
      coffee: {
        excellent: { minScore: 85, grade: 'AA', priceMultiplier: 1.3 },
        good: { minScore: 70, grade: 'A', priceMultiplier: 1.1 },
        average: { minScore: 55, grade: 'B', priceMultiplier: 1.0 },
        poor: { minScore: 35, grade: 'C', priceMultiplier: 0.7 }
      }
    };
  }

  /**
   * Analyse principale de la qualité d'un produit
   * @param {Buffer} imageBuffer - Image du produit à analyser
   * @param {string} productType - Type de produit ('cocoa', 'coffee', etc.)
   * @param {Object} metadata - Métadonnées additionnelles (géolocalisation, date récolte)
   * @returns {Object} Résultat d'analyse avec score et recommandations
   */
  async analyzeProductQuality(imageBuffer, productType = 'cocoa', metadata = {}) {
    try {
      console.log(`Début analyse qualité pour ${productType}`);
      const startTime = Date.now();

      // 1. Préprocessing de l'image
      const processedImage = await this.preprocessImage(imageBuffer);

      // 2. Upload vers S3 pour archivage
      const imageUrl = await this.uploadToS3(processedImage, productType);

      // 3. Analyse multi-modal avec Google Vision
      const visionResults = await this.runVisionAnalysis(processedImage);

      // 4. Calcul du score de qualité spécialisé
      const qualityScore = await this.calculateQualityScore(
        visionResults, 
        productType, 
        metadata
      );

      // 5. Génération des recommandations
      const recommendations = this.generateRecommendations(qualityScore, productType);

      const analysisTime = Date.now() - startTime;
      console.log(`Analyse terminée en ${analysisTime}ms`);

      return {
        success: true,
        productType,
        qualityScore: qualityScore.overall,
        grade: qualityScore.grade,
        priceMultiplier: qualityScore.priceMultiplier,
        detailedScores: qualityScore.details,
        recommendations,
        confidence: qualityScore.confidence,
        imageUrl,
        analysisTime,
        timestamp: new Date().toISOString(),
        metadata: {
          ...metadata,
          visionApiVersion: 'v1',
          modelVersion: '2.1'
        }
      };

    } catch (error) {
      console.error('Erreur analyse qualité:', error);
      return {
        success: false,
        error: error.message,
        fallbackGrade: 'B', // Grade par défaut en cas d'erreur
        confidence: 0
      };
    }
  }

  /**
   * Préprocessing intelligent de l'image
   */
  async preprocessImage(imageBuffer) {
    try {
      // Optimisation pour l'analyse IA
      const processedBuffer = await sharp(imageBuffer)
        .resize(1024, 1024, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ 
          quality: 85, 
          progressive: true 
        })
        .normalize() // Améliore le contraste
        .sharpen() // Augmente la netteté pour la détection
        .toBuffer();

      return processedBuffer;
    } catch (error) {
      throw new Error(`Erreur preprocessing: ${error.message}`);
    }
  }

  /**
   * Analyse complète avec Google Vision API
   */
  async runVisionAnalysis(imageBuffer) {
    try {
      const image = { content: imageBuffer.toString('base64') };

      // Exécution parallèle de toutes les analyses
      const [
        objectsResult,
        labelsResult,
        colorsResult,
        textResult,
        safeSearchResult
      ] = await Promise.all([
        this.visionClient.objectLocalization(image),
        this.visionClient.labelDetection(image),
        this.visionClient.imageProperties(image),
        this.visionClient.textDetection(image),
        this.visionClient.safeSearchDetection(image)
      ]);

      return {
        objects: objectsResult[0].localizedObjectAnnotations || [],
        labels: labelsResult[0].labelAnnotations || [],
        colors: colorsResult[0].imagePropertiesAnnotation?.dominantColors?.colors || [],
        text: textResult[0].textAnnotations || [],
        safeSearch: safeSearchResult[0].safeSearchAnnotation
      };

    } catch (error) {
      throw new Error(`Erreur Google Vision API: ${error.message}`);
    }
  }

  /**
   * Calcul spécialisé du score de qualité pour le cacao
   */
  async calculateCocoaQuality(visionResults, metadata) {
    const scores = {
      beanSize: 0,      // Taille et uniformité des fèves
      color: 0,         // Couleur et maturation
      defects: 0,       // Défauts visibles (moisissures, insectes)
      moisture: 0,      // Estimation humidité
      cleanliness: 0    // Propreté générale
    };

    // 1. Analyse de la taille des fèves
    const cocoaBeans = visionResults.objects.filter(obj => 
      obj.name.toLowerCase().includes('bean') || 
      obj.name.toLowerCase().includes('seed') ||
      obj.name.toLowerCase().includes('cocoa')
    );

    if (cocoaBeans.length > 0) {
      // Calcul uniformité des tailles
      const sizes = cocoaBeans.map(bean => {
        const width = Math.abs(bean.boundingPoly.normalizedVertices[1].x - bean.boundingPoly.normalizedVertices[0].x);
        const height = Math.abs(bean.boundingPoly.normalizedVertices[2].y - bean.boundingPoly.normalizedVertices[0].y);
        return width * height;
      });

      const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      const sizeVariance = sizes.reduce((acc, size) => acc + Math.pow(size - avgSize, 2), 0) / sizes.length;
      
      scores.beanSize = Math.max(0, 100 - (sizeVariance * 1000)); // Plus la variance est faible, meilleur le score
    }

    // 2. Analyse des couleurs (cacao bien fermenté = brun chocolat uniforme)
    const targetCocoaColors = ['brown', 'chocolate', 'dark brown'];
    let colorScore = 0;
    
    visionResults.colors.forEach(color => {
      const { red, green, blue } = color.color;
      
      // Couleur idéale cacao: RGB(101, 67, 33) - brun chocolat
      const idealR = 101, idealG = 67, idealB = 33;
      const colorDistance = Math.sqrt(
        Math.pow(red - idealR, 2) + 
        Math.pow(green - idealG, 2) + 
        Math.pow(blue - idealB, 2)
      );
      
      // Plus la couleur est proche de l'idéal, meilleur le score
      const proximityScore = Math.max(0, 100 - (colorDistance / 2));
      colorScore += proximityScore * color.pixelFraction;
    });
    
    scores.color = Math.min(100, colorScore);

    // 3. Détection de défauts
    const defectLabels = ['mold', 'fungus', 'insect', 'damage', 'rot', 'crack'];
    let defectPenalty = 0;
    
    visionResults.labels.forEach(label => {
      defectLabels.forEach(defect => {
        if (label.description.toLowerCase().includes(defect)) {
          defectPenalty += label.score * 50; // Pénalité proportionnelle à la confiance
        }
      });
    });
    
    scores.defects = Math.max(0, 100 - defectPenalty);

    // 4. Estimation de l'humidité via l'analyse de brillance
    let brightnessScore = 0;
    visionResults.colors.forEach(color => {
      // Calcul de la luminosité
      const { red, green, blue } = color.color;
      const brightness = (red * 0.299 + green * 0.587 + blue * 0.114);
      
      // Humidité optimale cacao: brillance modérée (pas trop sec, pas trop humide)
      const optimalBrightness = 120; // Valeur empirique
      const deviation = Math.abs(brightness - optimalBrightness);
      const pixelScore = Math.max(0, 100 - deviation);
      
      brightnessScore += pixelScore * color.pixelFraction;
    });
    
    scores.moisture = brightnessScore;

    // 5. Propreté générale
    const cleanlinessLabels = ['clean', 'pure', 'fresh'];
    const dirtyLabels = ['dirty', 'dust', 'debris', 'contaminated'];
    
    let cleanlinessScore = 70; // Score de base
    
    visionResults.labels.forEach(label => {
      cleanlinessLabels.forEach(clean => {
        if (label.description.toLowerCase().includes(clean)) {
          cleanlinessScore += label.score * 30;
        }
      });
      
      dirtyLabels.forEach(dirty => {
        if (label.description.toLowerCase().includes(dirty)) {
          cleanlinessScore -= label.score * 40;
        }
      });
    });
    
    scores.cleanliness = Math.max(0, Math.min(100, cleanlinessScore));

    return scores;
  }

  /**
   * Calcul du score global et attribution du grade
   */
  async calculateQualityScore(visionResults, productType, metadata) {
    let detailedScores;
    
    // Analyse spécialisée selon le type de produit
    switch (productType) {
      case 'cocoa':
        detailedScores = await this.calculateCocoaQuality(visionResults, metadata);
        break;
      case 'coffee':
        detailedScores = await this.calculateCoffeeQuality(visionResults, metadata);
        break;
      default:
        detailedScores = await this.calculateGenericQuality(visionResults, metadata);
    }

    // Pondération des différents critères pour le score global
    const weights = {
      beanSize: 0.25,
      color: 0.25,
      defects: 0.30,
      moisture: 0.15,
      cleanliness: 0.05
    };

    const overallScore = Object.keys(detailedScores).reduce((total, criterion) => {
      return total + (detailedScores[criterion] * (weights[criterion] || 0));
    }, 0);

    // Attribution du grade selon les seuils
    const thresholds = this.qualityThresholds[productType] || this.qualityThresholds.cocoa;
    let grade = 'D';
    let priceMultiplier = 0.6;
    
    for (const [level, config] of Object.entries(thresholds)) {
      if (overallScore >= config.minScore) {
        grade = config.grade;
        priceMultiplier = config.priceMultiplier;
        break;
      }
    }

    // Calcul de la confiance basée sur la qualité des détections
    const avgConfidence = visionResults.labels
      .reduce((sum, label) => sum + label.score, 0) / visionResults.labels.length || 0;

    return {
      overall: Math.round(overallScore),
      details: detailedScores,
      grade,
      priceMultiplier,
      confidence: Math.round(avgConfidence * 100),
      objectsDetected: visionResults.objects.length,
      labelsDetected: visionResults.labels.length
    };
  }

  /**
   * Génération de recommandations personnalisées
   */
  generateRecommendations(qualityScore, productType) {
    const recommendations = [];
    const { details, overall, grade } = qualityScore;

    // Recommandations spécifiques selon les scores
    if (details.beanSize < 70) {
      recommendations.push({
        category: 'Taille des fèves',
        issue: 'Fèves de taille irrégulière détectées',
        suggestion: 'Améliorez le tri pour séparer les fèves selon leur taille',
        priority: 'high',
        impact: 'Prix +10-15%'
      });
    }

    if (details.color < 60) {
      recommendations.push({
        category: 'Fermentation',
        issue: 'Couleur indique une fermentation incomplète',
        suggestion: 'Prolongez la fermentation de 1-2 jours supplémentaires',
        priority: 'high',
        impact: 'Grade A possible'
      });
    }

    if (details.defects < 80) {
      recommendations.push({
        category: 'Défauts',
        issue: 'Défauts visibles détectés (moisissures ou insectes)',
        suggestion: 'Renforcez le séchage et le stockage dans un lieu sec',
        priority: 'critical',
        impact: 'Évite le déclassement'
      });
    }

    if (details.moisture < 65) {
      recommendations.push({
        category: 'Humidité',
        issue: 'Taux d\'humidité non optimal',
        suggestion: 'Ajustez le temps de séchage (optimal: 6-7%)',
        priority: 'medium',
        impact: 'Améliore la conservation'
      });
    }

    // Recommandations générales selon le grade
    if (grade === 'D') {
      recommendations.push({
        category: 'Amélioration générale',
        issue: 'Qualité en dessous des standards commerciaux',
        suggestion: 'Formation sur les bonnes pratiques post-récolte recommandée',
        priority: 'critical',
        impact: 'Passage grade C minimum'
      });
    }

    return recommendations;
  }

  /**
   * Upload sécurisé vers AWS S3
   */
  async uploadToS3(imageBuffer, productType) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${productType}-quality-${timestamp}.jpg`;
    const key = `quality-analysis/${productType}/${fileName}`;

    try {
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: imageBuffer,
        ContentType: 'image/jpeg',
        ServerSideEncryption: 'AES256',
        Metadata: {
          'analysis-type': 'quality-assessment',
          'product-type': productType,
          'upload-date': timestamp
        }
      };

      const result = await this.s3.upload(uploadParams).promise();
      return result.Location;
      
    } catch (error) {
      console.error('Erreur upload S3:', error);
      return null;
    }
  }

  /**
   * Méthode utilitaire pour obtenir un prix de référence
   */
  async getBasePrice(productType, location = 'abidjan') {
    try {
      // Simulation appel API prix (à remplacer par vraie API FAO)
      const basePrices = {
        cocoa: { abidjan: 850, yamoussoukro: 830, san_pedro: 870 },
        coffee: { abidjan: 1200, yamoussoukro: 1180, man: 1220 }
      };

      return basePrices[productType]?.[location] || basePrices[productType]?.abidjan || 800;
      
    } catch (error) {
      console.error('Erreur récupération prix:', error);
      return 800; // Prix par défaut
    }
  }

  /**
   * Calcul du prix suggéré basé sur l'analyse qualité
   */
  async calculateSuggestedPrice(qualityScore, productType, location) {
    const basePrice = await this.getBasePrice(productType, location);
    const adjustedPrice = basePrice * qualityScore.priceMultiplier;
    
    return {
      basePrice,
      adjustedPrice: Math.round(adjustedPrice),
      premium: Math.round(adjustedPrice - basePrice),
      premiumPercentage: Math.round(((adjustedPrice - basePrice) / basePrice) * 100)
    };
  }
}

// Exemple d'utilisation de la classe
async function main() {
  const analyzer = new ProductQualityAnalyzer();
  
  try {
    // Simulation d'une image de cacao uploadée
    const fs = require('fs');
    const imageBuffer = fs.readFileSync('./sample-cocoa-beans.jpg');
    
    const metadata = {
      farmerId: '507f1f77bcf86cd799439011',
      location: { lat: 5.3364, lng: -4.0267 }, // Abidjan
      harvestDate: '2024-01-15',
      variety: 'trinitario'
    };

    // Analyse de la qualité
    const result = await analyzer.analyzeProductQuality(
      imageBuffer, 
      'cocoa', 
      metadata
    );

    console.log('=== Résultat Analyse Qualité ===');
    console.log(`Grade: ${result.grade} (Score: ${result.qualityScore}/100)`);
    console.log(`Confiance: ${result.confidence}%`);
    console.log('\nScores détaillés:');
    Object.entries(result.detailedScores).forEach(([key, value]) => {
      console.log(`  ${key}: ${Math.round(value)}/100`);
    });

    // Calcul prix suggéré
    const pricing = await analyzer.calculateSuggestedPrice(
      result, 
      'cocoa', 
      'abidjan'
    );

    console.log('\n=== Prix Suggéré ===');
    console.log(`Prix de base: ${pricing.basePrice} FCFA/kg`);
    console.log(`Prix ajusté: ${pricing.adjustedPrice} FCFA/kg`);
    console.log(`Prime qualité: +${pricing.premium} FCFA/kg (+${pricing.premiumPercentage}%)`);

    console.log('\n=== Recommandations ===');
    result.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.category}`);
      console.log(`   Problème: ${rec.issue}`);
      console.log(`   Solution: ${rec.suggestion}`);
      console.log(`   Impact: ${rec.impact}\n`);
    });

  } catch (error) {
    console.error('Erreur:', error.message);
  }
}

// Export pour utilisation dans l'application
module.exports = ProductQualityAnalyzer;

// Configuration des variables d'environnement nécessaires
/*
Fichier .env requis:

# Google Cloud Vision API
GOOGLE_CLOUD_PROJECT_ID=agritrade-ai-vision
GOOGLE_CLOUD_KEYFILE=./config/google-cloud-credentials.json

# AWS S3
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  
AWS_REGION=eu-west-1
AWS_S3_BUCKET=agritrade-quality-images

# Base de données
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/agritrade

# APIs externes
FAO_API_KEY=your-fao-api-key
OPENWEATHER_API_KEY=your-openweather-key
*/

// Commandes d'installation des dépendances
/*
npm install @google-cloud/vision aws-sdk sharp mongoose dotenv

// ou avec yarn
yarn add @google-cloud/vision aws-sdk sharp mongoose dotenv
*/