# Multi-Source Log Forwarder to InfluxDB

Version 3.0 - A self-contained executable tool to extract JSON logs from Dynatrace or Splunk APIs, apply regex-based filtering, extract specific JSON tags, and forward them to InfluxDB 1.8.x.

## Features

- **Multi-Source Support**: Connect to Dynatrace and Splunk APIs
- **Flexible Filtering**: Apply regex patterns to filter logs
- **Tag Extraction**: Extract specific JSON fields and map to InfluxDB tags/fields
- **Scheduled Processing**: Configure cron-based job scheduling
- **Web UI**: Complete configuration management through React-based interface
- **Self-Contained**: Single executable with embedded database and UI

## Architecture

- **Frontend**: React 19 + TypeScript + Mantine UI
- **Backend**: Express 5 + Node.js 18+
- **Database**: SQLite (better-sqlite3)
- **Build**: pkg for single executable

## Prerequisites

- Node.js 18.0 or higher
- npm 9.0 or higher

## Installation

### Development

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### Building Executable

```bash
# Build frontend and create Windows executable
npm run build
```

The executable will be created in `dist/log-forwarder.exe`

## Development

```bash
# Start backend server
npm run dev

# In another terminal, start frontend dev server
cd client
npm run dev
```

Backend runs on `http://localhost:3000`
Frontend runs on `http://localhost:5173`

## Usage

1. **Configure Log Sources**: Add Dynatrace or Splunk connections
2. **Define Regex Patterns**: Create filters for log entries
3. **Map Tags**: Define JSON path to InfluxDB tag/field mappings
4. **Configure InfluxDB**: Set up destination database connection
5. **Create Jobs**: Schedule processing jobs with cron expressions
6. **Monitor**: View activity logs and job status

## Project Structure

```
log-forwarder/
├── server/           # Backend Express server
│   ├── db/          # Database layer
│   ├── routes/      # API routes
│   └── services/    # Business logic
├── client/          # Frontend React application
│   └── src/         # Source files
└── dist/            # Build output
```

## License

Proprietary - Company Internal Use
