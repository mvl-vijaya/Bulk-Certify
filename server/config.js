import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  defaultGeminiApiKey: process.env.GEMINI_API_KEY || '',
  maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10),
  get maxFileSizeBytes() {
    return this.maxFileSizeMB * 1024 * 1024;
  }
};

