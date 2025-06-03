# NodeJS ETL Processor Tool

A Node.js application that implements an ETL (Extract, Transform, Load) process to fetch university data from an external API, process it, and provide CSV download functionality.

## Disclaimer

A large portion of this code and content was generated using AI. But there are key aspects to consider:

- The code was revised and curated by me to avoid adding boilerplate functionality beyond the scope of the test and mistakes caused by the AI.
- Content of this README went through the same process.
- AI generated a test suite which I did not include since it was beyond the scope of the test in my opinion, will glady discuss my own approach to writting potential test cases if necessary.
- The ETL processing reads an pre-defined array of countries, I have USA listed on that array althought I get failures from the API while calling it with this parameter -> "United+States". Passing values like "USA" and "United States" render no results.

## Features

- **Extract**: Fetches university data from http://universities.hipolabs.com/search?country=United+States
- **Transform**: Cleans, validates, and standardizes the data
- **Load**: Stores data in JSON format and generates CSV files
- **Scheduled Refresh**: Automatically updates data daily at midnight UTC using a cron job
- **API Endpoints**: Provides REST API for data access and CSV downloads
- **Error Handling**: Robust error handling with logging
- **Data Quality**: Filters invalid entries and ensures data consistency

## Prerequisites

- Node.js (version 16.0.0 or higher)
- npm (version 8.0.0 or higher)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/luis-trejos-0289/node-js-etl-processor.git
cd university-etl-processor
```

2. Install dependencies:
```bash
npm install
```

3. Start the application:
```bash
npm start
```

## API Documentation

### Base URL
```
http://localhost:3000
```

### Endpoints

#### 1. Get API Information
```http
GET /
```
Returns available endpoints and basic API information.

**Response:**
```json
{
  "message": "University ETL API",
  "endpoints": {
    "/api/universities/csv": "Download universities data as CSV",
    "/api/universities/json": "Get universities data as JSON",
    "/api/refresh": "Manually trigger data refresh",
    "/api/status": "Get system status"
  }
}
```

#### 2. Download CSV File
```http
GET /api/universities/csv
```
Downloads the university data as a CSV file.

**Response:**
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename=universities.csv`

**CSV Columns:**
- name
- country
- state_province
- alpha_two_code
- primary_domain
- primary_website
- last_updated

#### 3. Get JSON Data
```http
GET /api/universities/json
```
Returns university data in JSON format.

**Response:**
```json
{
  "count": 4321,
  "data": [
    {
      "name": "Example University",
      "country": "United States",
      "state_province": "California",
      "alpha_two_code": "US",
      "domains": ["example.edu"],
      "web_pages": ["https://www.example.edu"],
      "primary_domain": "example.edu",
      "primary_website": "https://www.example.edu",
      "last_updated": "2024-01-15T10:30:00.000Z"
    }
  ],
  "last_updated": "2024-01-15T10:30:00.000Z"
}
```

#### 4. Manual Data Refresh
```http
POST /api/refresh
```
Manually triggers the ETL process to refresh data.

**Response (Success):**
```json
{
  "message": "Data refresh completed successfully",
  "recordCount": 4321,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Response (Error):**
```json
{
  "error": "Data refresh failed",
  "details": "Network timeout after 3 attempts",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Architecture

### ETL Process

1. **Extract Phase**
   - Fetches data from the universities API
   - Handles network timeouts and errors
   - Validates API response format

2. **Transform Phase**
   - Filters out entries with missing essential fields
   - Standardizes data types and formats
   - Trims whitespace and normalizes strings
   - Adds computed fields (primary_domain, primary_website)
   - Adds last_updated timestamp

3. **Stage Phase**
   - Saves data as JSON file for internal use
   - Generates CSV file for download endpoint
   - Creates data directory if it doesn't exist
   - Atomic file operations to prevent corruption

### Scheduling

- Uses node-cron to schedule daily data refresh at midnight UTC
- Configurable timezone support
- Graceful error handling for scheduled jobs

### Error Handling

- Comprehensive logging system with timestamps
- Graceful degradation when data is unavailable
- Proper HTTP status codes and error messages

## Data Schema

### Raw API Data
The external API returns university objects with the following structure:
```json
{
  "name": "University Name",
  "country": "United States", 
  "state-province": "State Name",
  "alpha_two_code": "US",
  "domains": ["university.edu"],
  "web_pages": ["https://www.university.edu"]
}
```

### Transformed Data
After processing, data is stored with this schema:
```json
{
  "name": "University Name",
  "country": "United States",
  "state_province": "State Name", 
  "alpha_two_code": "US",
  "domains": ["university.edu"],
  "web_pages": ["https://www.university.edu"],
  "primary_domain": "university.edu",
  "primary_website": "https://www.university.edu",
  "last_updated": "2024-01-15T10:30:00.000Z"
}
```

## File Structure

```
university-etl-process/
├── server.js              # Main application file
├── package.json           # Dependencies and scripts
├── README.md             # This file
├── data/                 # Generated data files
│   ├── universities.json # JSON data storage
│   └── universities.csv  # CSV export file
└── logs/                 # Application logs (future enhancement)
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

### Customization Options

You can modify these constants in `server.js`:
- `DATA_FILE`: Path for JSON data storage
- `CSV_FILE`: Path for CSV export file
- API timeout settings
- Retry attempt counts
- Cron schedule pattern

## Data Quality Improvements

### Current Implementations

1. **Data Validation**
   - Filters universities without names or websites
   - Validates array fields (domains, web_pages)
   - Ensures required fields are present

2. **Data Standardization**
   - Trims whitespace from all string fields
   - Converts all fields to appropriate types
   - Normalizes null/undefined values

3. **Data Enhancement**
   - Adds primary_domain and primary_website fields
   - Includes last_updated timestamps
   - Maintains original data structure for reference

### Future Enhancements

1. **Advanced Validation**
   - URL format validation for web pages
   - Domain name validation
   - State/province standardization

2. **Data Enrichment**
   - University ranking data
   - Student enrollment numbers
   - Geographic coordinates

3. **Duplicate Detection**
   - Name similarity matching
   - Domain-based deduplication
   - Fuzzy matching algorithms

## Database Design Considerations

### Recommended Data Model Schema

```sql
-- Universities table
CREATE TABLE universities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100) NOT NULL,
  state_province VARCHAR(100),
  alpha_two_code CHAR(2),
  primary_domain VARCHAR(255),
  primary_website VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, state_province)
);

-- Domains table (one-to-many relationship)
CREATE TABLE university_domains (
  id SERIAL PRIMARY KEY,
  university_id INTEGER REFERENCES universities(id),
  domain VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Web pages table (one-to-many relationship)  
CREATE TABLE university_web_pages (
  id SERIAL PRIMARY KEY,
  university_id INTEGER REFERENCES universities(id),
  url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Upsert Strategy

From a pure SQL standpoint this will be the ideal way to handle upserts and conflicts on existing records. 

```sql
-- Example upsert query for PostgreSQL
INSERT INTO universities (name, country, state_province, alpha_two_code, primary_domain, primary_website, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
ON CONFLICT (name, state_province) 
DO UPDATE SET 
  country = EXCLUDED.country,
  alpha_two_code = EXCLUDED.alpha_two_code,
  primary_domain = EXCLUDED.primary_domain,
  primary_website = EXCLUDED.primary_website,
  updated_at = CURRENT_TIMESTAMP;
```

There are ORM tools that allow to handle upserts and conflict very efficiently, Drizzle example:

https://orm.drizzle.team/docs/guides/upsert

## Development

### Scripts

- `npm start`: Start production server

2. **Error Scenarios**
- Network failures
- Invalid API responses. NOTE: The USA parameter filter causes the axios client to abort the connection, this particular parameter is not working as expected.
- File system errors

### Monitoring

The application provides extensive logging:
- INFO: Normal operations and successful processes
- WARN: Non-critical issues and warnings
- ERROR: Failures and exceptions