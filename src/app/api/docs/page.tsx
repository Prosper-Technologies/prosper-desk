import SwaggerUIWrapper from "~/components/swagger-ui";
import { spec } from "~/lib/openapi-schema";

export default function ApiDocsPage() {
  return (
    <div className="container mx-auto max-w-7xl py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">API Documentation</h1>
          <p className="mt-2 text-muted-foreground">
            Interactive documentation for Prosper Desk&apos;s REST API. Test
            endpoints directly from your browser.
          </p>
        </div>

        {/* Swagger UI */}
        <div className="overflow-hidden rounded-lg border bg-white">
          <SwaggerUIWrapper spec={spec} />
        </div>
      </div>
    </div>
  );
}
