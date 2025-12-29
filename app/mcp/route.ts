import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler(
  async (server) => {
    server.tool(
      "httpx",
      "Scans target domains and detects active HTTP/HTTPS services using httpx.",
      {
        target: z
          .array(z.string())
          .min(1)
          .describe(
            "A list of domains (e.g., example.com) to scan for HTTP and HTTPS services."
          ),
        ports: z
          .array(z.number())
          .optional()
          .describe("Optional list of ports to scan, e.g., 80,443."),
        probes: z
          .array(z.string())
          .optional()
          .describe(
            "httpx probe flags, e.g., status-code, title, content-length, web-server, tech-detect, favicon, jarm, etc."
          ),
      },
      async ({ target, ports, probes }) => {
        const args: string[] = ["-u", target.join(","), "-silent"];

        if (ports && ports.length > 0) {
          args.push("-p", ports.join(","));
        }

        if (probes && probes.length > 0) {
          for (const probe of probes) {
            args.push(`-${probe}`);
          }
        }

        const command = `httpx ${args.join(" ")}`;

        return {
          content: [
            {
              type: "text",
              text:
                "Run this command locally (or in an environment with httpx installed):\n\n" +
                command +
                "\n\nThis server builds the command; execution of CLI binaries isn't performed in the hosted environment.",
            },
          ],
        };
      }
    );
  },
  {
    capabilities: {
      tools: {
        httpx: {
          description:
            "Scans target domains with httpx and lists active HTTP/HTTPS services. Returns a ready-to-run command string.",
        },
      },
    },
  },
  {
    basePath: "",
    verboseLogs: true,
    maxDuration: 60,
    disableSse: true,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
