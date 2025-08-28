import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { QualityAnalysisState, QualityResult, Recommendation, AnalysisSession, ImageData, ProductMetadata } from '@/types';
import { qualityAnalysisService } from '@/services/qualityAnalysisService';

// Initial state
const initialState: QualityAnalysisState = {
  currentAnalysis: null,
  results: [],
  recommendations: [],
  isAnalyzing: false,
  progress: 0,
};

// Async thunks
export const startAnalysis = createAsyncThunk(
  'qualityAnalysis/startAnalysis',
  async ({ images, metadata }: { images: ImageData[]; metadata: ProductMetadata }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      
      // Add images to form data
      images.forEach((image, index) => {
        formData.append('images', {
          uri: image.uri,
          type: image.type,
          name: image.name,
        } as any);
      });
      
      // Add metadata
      formData.append('metadata', JSON.stringify(metadata));
      
      const response = await qualityAnalysisService.analyzeQuality(formData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Analysis failed');
    }
  }
);

export const getAnalysisProgress = createAsyncThunk(
  'qualityAnalysis/getProgress',
  async (analysisId: string, { rejectWithValue }) => {
    try {
      const response = await qualityAnalysisService.getAnalysisProgress(analysisId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get progress');
    }
  }
);

export const getAnalysisResult = createAsyncThunk(
  'qualityAnalysis/getResult',
  async (analysisId: string, { rejectWithValue }) => {
    try {
      const response = await qualityAnalysisService.getAnalysisResult(analysisId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get result');
    }
  }
);

export const getRecommendations = createAsyncThunk(
  'qualityAnalysis/getRecommendations',
  async (productId: string, { rejectWithValue }) => {
    try {
      const response = await qualityAnalysisService.getRecommendations(productId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get recommendations');
    }
  }
);

export const saveAnalysisResult = createAsyncThunk(
  'qualityAnalysis/saveResult',
  async ({ productId, resultData }: { productId: string; resultData: Partial<QualityResult> }, { rejectWithValue }) => {
    try {
      const response = await qualityAnalysisService.saveAnalysisResult(productId, resultData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to save result');
    }
  }
);

export const getAnalysisHistory = createAsyncThunk(
  'qualityAnalysis/getHistory',
  async (productId: string, { rejectWithValue }) => {
    try {
      const response = await qualityAnalysisService.getAnalysisHistory(productId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get history');
    }
  }
);

// Quality analysis slice
const qualityAnalysisSlice = createSlice({
  name: 'qualityAnalysis',
  initialState,
  reducers: {
    setCurrentAnalysis: (state, action: PayloadAction<AnalysisSession | null>) => {
      state.currentAnalysis = action.payload;
    },
    updateAnalysisProgress: (state, action: PayloadAction<number>) => {
      state.progress = action.payload;
      if (state.currentAnalysis) {
        state.currentAnalysis.progress = action.payload;
      }
    },
    updateAnalysisStatus: (state, action: PayloadAction<AnalysisSession['status']>) => {
      if (state.currentAnalysis) {
        state.currentAnalysis.status = action.payload;
      }
    },
    clearCurrentAnalysis: (state) => {
      state.currentAnalysis = null;
      state.progress = 0;
      state.isAnalyzing = false;
    },
    addRecommendation: (state, action: PayloadAction<Recommendation>) => {
      state.recommendations.push(action.payload);
    },
    removeRecommendation: (state, action: PayloadAction<string>) => {
      state.recommendations = state.recommendations.filter(rec => rec.id !== action.payload);
    },
    clearRecommendations: (state) => {
      state.recommendations = [];
    },
    addAnalysisResult: (state, action: PayloadAction<QualityResult>) => {
      state.results.unshift(action.payload);
    },
    clearAnalysisResults: (state) => {
      state.results = [];
    },
  },
  extraReducers: (builder) => {
    // Start analysis
    builder
      .addCase(startAnalysis.pending, (state) => {
        state.isAnalyzing = true;
        state.progress = 0;
      })
      .addCase(startAnalysis.fulfilled, (state, action) => {
        state.isAnalyzing = false;
        state.progress = 100;
        state.results.unshift(action.payload);
        state.currentAnalysis = null;
      })
      .addCase(startAnalysis.rejected, (state) => {
        state.isAnalyzing = false;
        state.progress = 0;
        if (state.currentAnalysis) {
          state.currentAnalysis.status = 'failed';
        }
      });

    // Get progress
    builder
      .addCase(getAnalysisProgress.fulfilled, (state, action) => {
        state.progress = action.payload.progress;
        if (state.currentAnalysis) {
          state.currentAnalysis.progress = action.payload.progress;
          state.currentAnalysis.status = action.payload.status;
        }
      });

    // Get result
    builder
      .addCase(getAnalysisResult.fulfilled, (state, action) => {
        state.isAnalyzing = false;
        state.progress = 100;
        const existingIndex = state.results.findIndex(r => r._id === action.payload._id);
        if (existingIndex !== -1) {
          state.results[existingIndex] = action.payload;
        } else {
          state.results.unshift(action.payload);
        }
      });

    // Get recommendations
    builder
      .addCase(getRecommendations.fulfilled, (state, action) => {
        state.recommendations = action.payload;
      });

    // Save result
    builder
      .addCase(saveAnalysisResult.fulfilled, (state, action) => {
        const existingIndex = state.results.findIndex(r => r._id === action.payload._id);
        if (existingIndex !== -1) {
          state.results[existingIndex] = action.payload;
        } else {
          state.results.unshift(action.payload);
        }
      });

    // Get history
    builder
      .addCase(getAnalysisHistory.fulfilled, (state, action) => {
        state.results = action.payload;
      });
  },
});

export const {
  setCurrentAnalysis,
  updateAnalysisProgress,
  updateAnalysisStatus,
  clearCurrentAnalysis,
  addRecommendation,
  removeRecommendation,
  clearRecommendations,
  addAnalysisResult,
  clearAnalysisResults,
} = qualityAnalysisSlice.actions;

export default qualityAnalysisSlice.reducer;