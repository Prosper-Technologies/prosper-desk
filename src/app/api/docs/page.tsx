"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function ApiDocsPage() {
  const [copiedText, setCopiedText] = useState<string>("");

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedText(""), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const CopyButton = ({ text, label }: { text: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => copyToClipboard(text, label)}
      className="h-6 w-6 p-0"
    >
      {copiedText === label ? (
        <Check className="h-3 w-3" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );

  return (
    <div className="container max-w-4xl py-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">API Documentation</h1>
          <p className="text-muted-foreground mt-2">
            Learn how to integrate with BlueDesk's REST API to manage tickets and comments programmatically.
          </p>
        </div>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>
              All API requests require authentication using API keys.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">API Key Format</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Include your API key in the Authorization header:
              </p>
              <div className="bg-muted rounded-md p-3 font-mono text-sm flex items-center justify-between">
                <span>Authorization: Bearer YOUR_API_KEY</span>
                <CopyButton text="Authorization: Bearer YOUR_API_KEY" label="auth-header" />
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Required Permissions</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">tickets:read</Badge>
                  <span className="text-sm">Read ticket data</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">tickets:create</Badge>
                  <span className="text-sm">Create new tickets</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">tickets:update</Badge>
                  <span className="text-sm">Update existing tickets</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">comments:read</Badge>
                  <span className="text-sm">Read ticket comments</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">comments:create</Badge>
                  <span className="text-sm">Add comments to tickets</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Base URL */}
        <Card>
          <CardHeader>
            <CardTitle>Base URL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-md p-3 font-mono text-sm flex items-center justify-between">
              <span>https://your-domain.com/api/v1</span>
              <CopyButton text="https://your-domain.com/api/v1" label="base-url" />
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Endpoints</h2>

          <Tabs defaultValue="tickets" className="w-full">
            <TabsList>
              <TabsTrigger value="tickets">Tickets</TabsTrigger>
              <TabsTrigger value="comments">Comments</TabsTrigger>
            </TabsList>

            <TabsContent value="tickets" className="space-y-4">
              {/* Get Tickets */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-800">GET</Badge>
                    <CardTitle className="text-lg">/tickets</CardTitle>
                  </div>
                  <CardDescription>Retrieve a list of tickets</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Query Parameters</h4>
                    <div className="space-y-2 text-sm">
                      <div><code className="bg-muted px-1 rounded">page</code> - Page number (default: 1)</div>
                      <div><code className="bg-muted px-1 rounded">limit</code> - Items per page (default: 25, max: 100)</div>
                      <div><code className="bg-muted px-1 rounded">status</code> - Filter by status (open, in_progress, resolved, closed)</div>
                      <div><code className="bg-muted px-1 rounded">priority</code> - Filter by priority (low, medium, high, urgent)</div>
                      <div><code className="bg-muted px-1 rounded">search</code> - Search in subject and description</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Example Request</h4>
                    <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
                      <code>{`curl -X GET "https://your-domain.com/api/v1/tickets?page=1&limit=10&status=open" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</code>
                    </pre>
                  </div>
                </CardContent>
              </Card>

              {/* Create Ticket */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800">POST</Badge>
                    <CardTitle className="text-lg">/tickets</CardTitle>
                  </div>
                  <CardDescription>Create a new ticket</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Request Body</h4>
                    <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
                      <code>{`{
  "subject": "Website loading issues",
  "description": "The website is taking too long to load on mobile devices",
  "priority": "high",
  "customer_email": "user@example.com",
  "customer_name": "John Doe",
  "tags": ["website", "performance"]
}`}</code>
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Example Request</h4>
                    <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
                      <code>{`curl -X POST "https://your-domain.com/api/v1/tickets" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subject": "Website loading issues",
    "description": "The website is taking too long to load",
    "priority": "high",
    "customer_email": "user@example.com",
    "customer_name": "John Doe"
  }'`}</code>
                    </pre>
                  </div>
                </CardContent>
              </Card>

              {/* Get Single Ticket */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-800">GET</Badge>
                    <CardTitle className="text-lg">/tickets/{"{id}"}</CardTitle>
                  </div>
                  <CardDescription>Get a specific ticket by ID</CardDescription>
                </CardHeader>
                <CardContent>
                  <div>
                    <h4 className="font-semibold mb-2">Example Request</h4>
                    <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
                      <code>{`curl -X GET "https://your-domain.com/api/v1/tickets/123e4567-e89b-12d3-a456-426614174000" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</code>
                    </pre>
                  </div>
                </CardContent>
              </Card>

              {/* Update Ticket */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-100 text-yellow-800">PUT</Badge>
                    <CardTitle className="text-lg">/tickets/{"{id}"}</CardTitle>
                  </div>
                  <CardDescription>Update an existing ticket</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Request Body (all fields optional)</h4>
                    <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
                      <code>{`{
  "subject": "Updated subject",
  "description": "Updated description",
  "status": "in_progress",
  "priority": "urgent",
  "tags": ["updated", "urgent"]
}`}</code>
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comments" className="space-y-4">
              {/* Get Comments */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-800">GET</Badge>
                    <CardTitle className="text-lg">/tickets/{"{id}"}/comments</CardTitle>
                  </div>
                  <CardDescription>Get all comments for a ticket</CardDescription>
                </CardHeader>
                <CardContent>
                  <div>
                    <h4 className="font-semibold mb-2">Example Request</h4>
                    <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
                      <code>{`curl -X GET "https://your-domain.com/api/v1/tickets/123e4567-e89b-12d3-a456-426614174000/comments" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</code>
                    </pre>
                  </div>
                </CardContent>
              </Card>

              {/* Add Comment */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800">POST</Badge>
                    <CardTitle className="text-lg">/tickets/{"{id}"}/comments</CardTitle>
                  </div>
                  <CardDescription>Add a comment to a ticket</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Request Body</h4>
                    <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
                      <code>{`{
  "content": "This issue has been resolved by updating the server configuration.",
  "customer_email": "user@example.com",
  "customer_name": "John Doe"
}`}</code>
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Example Request</h4>
                    <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
                      <code>{`curl -X POST "https://your-domain.com/api/v1/tickets/123e4567-e89b-12d3-a456-426614174000/comments" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "Issue has been resolved",
    "customer_email": "user@example.com",
    "customer_name": "John Doe"
  }'`}</code>
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Response Format */}
        <Card>
          <CardHeader>
            <CardTitle>Response Format</CardTitle>
            <CardDescription>
              All API responses follow a consistent format
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Success Response</h4>
              <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
                <code>{`{
  "data": { /* Response data */ },
  "pagination": { /* Only for list endpoints */
    "page": 1,
    "limit": 25,
    "total": 100,
    "total_pages": 4
  }
}`}</code>
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Error Response</h4>
              <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
                <code>{`{
  "error": "Error message",
  "details": [ /* Additional error details if applicable */ ]
}`}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Status Codes */}
        <Card>
          <CardHeader>
            <CardTitle>HTTP Status Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-100 text-green-800">200</Badge>
                <span>OK - Request successful</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-100 text-green-800">201</Badge>
                <span>Created - Resource created successfully</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-red-100 text-red-800">400</Badge>
                <span>Bad Request - Invalid request parameters</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-red-100 text-red-800">401</Badge>
                <span>Unauthorized - Invalid or missing API key</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-red-100 text-red-800">403</Badge>
                <span>Forbidden - Insufficient permissions</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-red-100 text-red-800">404</Badge>
                <span>Not Found - Resource not found</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-red-100 text-red-800">500</Badge>
                <span>Internal Server Error - Server error</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}