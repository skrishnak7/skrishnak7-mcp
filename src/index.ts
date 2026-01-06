import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const FlightSearchSchema = z.object({
  origin: z.string().length(3, "Use a 3-letter IATA origin code"),
  destination: z.string().length(3, "Use a 3-letter IATA destination code"),
  departureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
  adults: z.number().int().min(1).max(9).optional(),
  nonStop: z.boolean().optional(),
  maxResults: z.number().int().min(1).max(50).optional(),
});

const toolSchema = {
  type: "object",
  properties: {
    origin: {
      type: "string",
      description: "3-letter IATA origin code, e.g. SFO",
    },
    destination: {
      type: "string",
      description: "3-letter IATA destination code, e.g. JFK",
    },
    departureDate: {
      type: "string",
      description: "Date in YYYY-MM-DD format",
    },
    adults: {
      type: "integer",
      description: "Number of adult travelers (1-9). Default is 1.",
      minimum: 1,
      maximum: 9,
    },
    nonStop: {
      type: "boolean",
      description: "If true, return only non-stop options.",
    },
    maxResults: {
      type: "integer",
      description: "Maximum number of offers to return (1-50).",
      minimum: 1,
      maximum: 50,
    },
  },
  required: ["origin", "destination", "departureDate"],
};

const server = new Server(
  { name: "skrishnak7-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "find_flight_schedule",
        description:
          "Find available flight options between two airports on a date using Amadeus Flight Offers Search.",
        inputSchema: toolSchema,
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "find_flight_schedule") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const parsed = FlightSearchSchema.safeParse(request.params.arguments);
  if (!parsed.success) {
    return {
      content: [
        {
          type: "text",
          text: `Invalid inputs: ${parsed.error.issues
            .map((issue) => issue.message)
            .join("; ")}`,
        },
      ],
      isError: true,
    };
  }

  const {
    origin,
    destination,
    departureDate,
    adults = 1,
    nonStop = false,
    maxResults = 10,
  } = parsed.data;

  try {
    const accessToken = await getAmadeusToken();
    const baseUrl = getAmadeusBaseUrl();
    const params = new URLSearchParams({
      originLocationCode: origin.toUpperCase(),
      destinationLocationCode: destination.toUpperCase(),
      departureDate,
      adults: String(adults),
      nonStop: String(nonStop),
      max: String(maxResults),
    });

    const response = await fetch(
      `${baseUrl}/v2/shopping/flight-offers?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Amadeus error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const summarized = summarizeOffers(data);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(summarized, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : "Unknown error",
        },
      ],
      isError: true,
    };
  }
});

async function getAmadeusToken(): Promise<string> {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing AMADEUS_CLIENT_ID or AMADEUS_CLIENT_SECRET environment variables."
    );
  }

  const baseUrl = getAmadeusBaseUrl();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token error ${response.status}: ${text}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("Token response missing access_token.");
  }

  return data.access_token as string;
}

function getAmadeusBaseUrl(): string {
  const env = process.env.AMADEUS_ENV?.toLowerCase();
  return env === "production"
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";
}

function summarizeOffers(data: {
  data?: Array<{
    price?: { total?: string; currency?: string };
    itineraries?: Array<{
      duration?: string;
      segments?: Array<{
        carrierCode?: string;
        number?: string;
        departure?: { iataCode?: string; at?: string };
        arrival?: { iataCode?: string; at?: string };
      }>;
    }>;
  }>;
}) {
  if (!data?.data?.length) {
    return { offers: [], message: "No flight offers found." };
  }

  const offers = data.data.map((offer) => ({
    price: offer.price?.total
      ? `${offer.price.total} ${offer.price.currency ?? ""}`.trim()
      : "Unknown",
    itineraries: offer.itineraries?.map((itinerary) => ({
      duration: itinerary.duration ?? "Unknown",
      segments:
        itinerary.segments?.map((segment) => ({
          flight: `${segment.carrierCode ?? ""}${segment.number ?? ""}`.trim(),
          from: segment.departure?.iataCode ?? "Unknown",
          to: segment.arrival?.iataCode ?? "Unknown",
          departAt: segment.departure?.at ?? "Unknown",
          arriveAt: segment.arrival?.at ?? "Unknown",
        })) ?? [],
    })),
  }));

  return { offers };
}

const transport = new StdioServerTransport();
await server.connect(transport);
