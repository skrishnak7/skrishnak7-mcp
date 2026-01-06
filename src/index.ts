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
  country: z.string().length(2).optional(),
  currency: z.string().length(3).optional(),
  locale: z.string().min(2).max(10).optional(),
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
    country: {
      type: "string",
      description: "Market country code (ISO-2). Default is US.",
    },
    currency: {
      type: "string",
      description: "Currency code (ISO-3). Default is USD.",
    },
    locale: {
      type: "string",
      description: "Locale like en-US. Default is en-US.",
    },
    maxResults: {
      type: "integer",
      description: "Maximum number of quotes to return (1-50).",
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
          "Find available flight options between two airports on a date using Skyscanner Browse Quotes.",
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
    country = "US",
    currency = "USD",
    locale = "en-US",
    maxResults = 10,
  } = parsed.data;

  try {
    const { baseUrl, headers } = getSkyscannerConfig();
    const url = `${baseUrl}/apiservices/browsequotes/v1.0/${country}/${currency}/${locale}/${origin.toUpperCase()}/${destination.toUpperCase()}/${departureDate}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Skyscanner error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const summarized = summarizeQuotes(data, maxResults);

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

function getSkyscannerConfig(): { baseUrl: string; headers: HeadersInit } {
  const apiKey = process.env.SKYSCANNER_API_KEY;
  const apiHost =
    process.env.SKYSCANNER_API_HOST ??
    "skyscanner-skyscanner-flight-search-v1.p.rapidapi.com";
  const baseUrl = process.env.SKYSCANNER_BASE_URL ?? `https://${apiHost}`;

  if (!apiKey) {
    throw new Error("Missing SKYSCANNER_API_KEY environment variable.");
  }

  return {
    baseUrl,
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": apiHost,
    },
  };
}

type SkyscannerBrowseQuotesResponse = {
  Quotes?: Array<{
    QuoteId?: number;
    MinPrice?: number;
    Direct?: boolean;
    OutboundLeg?: {
      CarrierIds?: number[];
      OriginId?: number;
      DestinationId?: number;
      DepartureDate?: string;
    };
  }>;
  Places?: Array<{ PlaceId?: number; IataCode?: string; Name?: string }>;
  Carriers?: Array<{ CarrierId?: number; Name?: string }>;
};

function summarizeQuotes(
  data: SkyscannerBrowseQuotesResponse,
  maxResults: number
) {
  if (!data?.Quotes?.length) {
    return { quotes: [], message: "No flight quotes found." };
  }

  const placeMap = new Map(
    data.Places?.map((place) => [place.PlaceId, place]) ?? []
  );
  const carrierMap = new Map(
    data.Carriers?.map((carrier) => [carrier.CarrierId, carrier]) ?? []
  );

  const quotes = data.Quotes.slice(0, maxResults).map((quote) => {
    const outbound = quote.OutboundLeg;
    const carrierNames =
      outbound?.CarrierIds?.map((id) => carrierMap.get(id)?.Name).filter(
        Boolean
      ) ?? [];
    const origin = placeMap.get(outbound?.OriginId);
    const destination = placeMap.get(outbound?.DestinationId);

    return {
      price: quote.MinPrice ?? "Unknown",
      direct: quote.Direct ?? false,
      carriers: carrierNames,
      origin: origin?.IataCode ?? origin?.Name ?? "Unknown",
      destination: destination?.IataCode ?? destination?.Name ?? "Unknown",
      departureDate: outbound?.DepartureDate ?? "Unknown",
    };
  });

  return { quotes };
}

const transport = new StdioServerTransport();
await server.connect(transport);
