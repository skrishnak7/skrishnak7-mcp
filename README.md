# skrishnak7-mcp

Sample MCP server that exposes a flight schedule finder tool backed by the
Skyscanner Browse Quotes API (via RapidAPI).

## Features
- MCP tool: `find_flight_schedule`
- Skyscanner Browse Quotes lookup
- Simple summary of flight quotes

## Setup
1) Create a RapidAPI account and subscribe to a Skyscanner API.
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
        "SKYSCANNER_API_KEY": "your_rapidapi_key_here",
        "SKYSCANNER_API_HOST": "skyscanner-skyscanner-flight-search-v1.p.rapidapi.com",
        "SKYSCANNER_BASE_URL": "https://skyscanner-skyscanner-flight-search-v1.p.rapidapi.com"
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
  "country": "US",
  "currency": "USD",
  "locale": "en-US",
  "maxResults": 5
}
```

## Notes
- This uses the legacy Skyscanner Browse Quotes endpoint on RapidAPI.
- Update the host or base URL if your RapidAPI Skyscanner API differs.
