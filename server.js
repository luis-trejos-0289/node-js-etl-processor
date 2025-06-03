const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { parse } = require('json2csv');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'universities.json');
const CSV_FILE = path.join(__dirname, 'data', 'universities.csv');

// Validate data directory exists
async function validateDataDirectory() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch (error) {
    // Make sure dir is created in case it does not exist
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Logger utility
const logger = {
  info: (message) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`),
  error: (message) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`),
  warn: (message) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`)
};

// Extract: Fetch data from API
async function extractData() {
  
  const countries = ['Costa Rica', 'Colombia', 'USA']

  const results = []

  await Promise.all(countries.map(async (country) => {
    const API_URL = `http://universities.hipolabs.com/search?country=${country}`;
  
    try {
      logger.info('Fetching data from API');
      const response = await axios.get(API_URL, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 200 && Array.isArray(response.data)) {
        logger.info(`Successfully fetched ${response.data.length} universities`);
        results.push(...response.data)
      } else {
        throw new Error(`Unexpected response format: ${response.status}`);
      }
    } catch (error) {
      logger.error(`Data extraction failed: ${error.message}`);
    }
  }));

  return results;
}

// Transform: Clean and validate data
function transformData(rawData) {
  logger.info('Transforming data...');
  
  const transformedData = rawData
    .filter(university => {
      // Filter out entries with missing essential fields
      return university.name && 
             university.country && 
             university.web_pages && 
             Array.isArray(university.web_pages) && 
             university.web_pages.length > 0;
    })
    .map(university => {
      // Clean and standardize the data
      return {
        name: String(university.name).trim(),
        country: String(university.country).trim(),
        state_province: university['state-province'] ? String(university['state-province']).trim() : null,
        alpha_two_code: university.alpha_two_code ? String(university.alpha_two_code).trim() : null,
        domains: Array.isArray(university.domains) ? university.domains.map(d => String(d).trim()) : [],
        web_pages: Array.isArray(university.web_pages) ? university.web_pages.map(w => String(w).trim()) : [],
        primary_domain: Array.isArray(university.domains) && university.domains.length > 0 ? 
                       String(university.domains[0]).trim() : null,
        primary_website: Array.isArray(university.web_pages) && university.web_pages.length > 0 ? 
                        String(university.web_pages[0]).trim() : null,
        last_updated: new Date().toISOString()
      };
    })
    .filter(university => university.name && university.country); // Final validation

  logger.info(`Transformed ${transformedData.length} universities (filtered from ${rawData.length})`);
  return transformedData;
}

// Load: Stage data to local dir to be downloaded by download endpoint
async function stageData(data) {
  try {
    logger.info('Loading data to file...');
    await validateDataDirectory();
    
    // Save as JSON
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    
    // Convert to CSV for download endpoint
    const csvFields = [
      'name',
      'country', 
      'state_province',
      'alpha_two_code',
      'primary_domain',
      'primary_website',
      'last_updated'
    ];
    
    const csvData = data.map(university => ({
      name: university.name,
      country: university.country,
      state_province: university.state_province || '',
      alpha_two_code: university.alpha_two_code || '',
      primary_domain: university.primary_domain || '',
      primary_website: university.primary_website || '',
      last_updated: university.last_updated
    }));
    
    const csv = parse(csvData, { fields: csvFields });
    await fs.writeFile(CSV_FILE, csv);
    
    logger.info(`Successfully saved ${data.length} universities to files`);
  } catch (error) {
    logger.error(`Failed to save data: ${error.message}`);
    throw error;
  }
}

// Main ETL Process
async function runETL() {
  try {
    logger.info('Starting ETL process...');
    
    // Extract
    const rawData = await extractData();

    if (rawData) {
        // Transform
        const transformedData = transformData(rawData);
        
        // Load
        await stageData(transformedData);
        
        logger.info('ETL process completed successfully');
        return { success: true, recordCount: transformedData.length };
    }
    else {
        logger.info('No extracted data available, skipping transformation and staging processes');
        return { success: true, recordCount: 0 };
    }
  
} catch (error) {
    logger.error(`ETL process failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// API Routes
app.get('/', (req, res) => {
  res.json({
    message: 'University ETL API',
    endpoints: {
      '/api/universities/csv': 'Download universities data as CSV',
      '/api/universities/json': 'Get universities data as JSON',
      '/api/refresh': 'Manually trigger data refresh',
    }
  });
});

// Download CSV endpoint
app.get('/api/universities/csv', async (req, res) => {
  try {
    await fs.access(CSV_FILE);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=universities.csv');
    
    const csvData = await fs.readFile(CSV_FILE);
    res.send(csvData);
    logger.info('CSV file downloaded');
  } catch (error) {
    logger.error(`Failed to serve CSV: ${error.message}`);
    res.status(404).json({ 
      error: 'CSV file not found. Please run the ETL process first.',
      suggestion: 'Try calling /api/refresh to generate the data'
    });
  }
});

// Get JSON data endpoint
app.get('/api/universities/json', async (req, res) => {
  try {
    await fs.access(DATA_FILE);
    const jsonData = await fs.readFile(DATA_FILE, 'utf8');
    const universities = JSON.parse(jsonData);
    
    res.json({
      count: universities.length,
      data: universities,
      last_updated: universities[0]?.last_updated || null
    });
    logger.info('JSON data served');
  } catch (error) {
    logger.error(`Failed to serve JSON: ${error.message}`);
    res.status(404).json({ 
      error: 'Data file not found. Please run the ETL process first.',
      suggestion: 'Try calling /api/refresh to generate the data'
    });
  }
});

// Manual refresh endpoint
app.post('/api/refresh', async (req, res) => {
  logger.info('Manual refresh triggered');
  const result = await runETL();
  
  if (result.success) {
    res.json({
      message: 'Data refresh completed successfully',
      recordCount: result.recordCount,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(500).json({
      error: 'Data refresh failed',
      details: result.error,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error(`Unhandled error: ${error.message}`);
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /api/universities/csv',
      'GET /api/universities/json', 
      'POST /api/refresh',
    ]
  });
});

// Schedule daily refresh at midnight UTC
cron.schedule('0 0 * * *', async () => {
  logger.info('Scheduled ETL process starting...');
  await runETL();
}, {
  timezone: 'UTC'
});

// Initialize server
async function startServer() {
  try {
    await validateDataDirectory();
    
    // Run initial ETL process
    logger.info('Running initial ETL process...');
    await runETL();
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API endpoints available at http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer();