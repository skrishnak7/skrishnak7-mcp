# skrishnak7-mcp

Sample MCP server that exposes a flight schedule finder tool backed by the
Amadeus Flight Offers Search API.

## Features
- MCP tool: `find_flight_schedule`
- Amadeus OAuth2 token flow
- Simple summary of flight offers

## Setup
1) Create an Amadeus account and get API keys.
2) Copy `.env.example` to `.env` and fill in values.
3) Install dependencies and build:

```bash
npm install
npm run build
```

## Run locally
```bash
npm run dev
```

## Claude Desktop configuration
Add a server entry to your Claude Desktop config:

```json
{
  "mcpServers": {
    "skrishnak7-mcp": {
      "command": "node",
      "args": ["/Users/krishnakanukuntla/skrishnak7-mcp/dist/index.js"],
      "env": {
        "AMADEUS_CLIENT_ID": "your_client_id_here",
        "AMADEUS_CLIENT_SECRET": "your_client_secret_here",
        "AMADEUS_ENV": "test"
      }
    }
  }
}
```

## Tool usage
Example inputs for `find_flight_schedule`:

```json
{
  "origin": "SFO",
  "destination": "JFK",
  "departureDate": "2025-06-15",
  "adults": 1,
  "nonStop": false,
  "maxResults": 5
}
```

## Notes
- The Amadeus test environment is used by default.
- Set `AMADEUS_ENV=production` to use live endpoints.
