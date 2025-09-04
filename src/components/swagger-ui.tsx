"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading API Documentation...</p>
      </div>
    </div>
  ),
});

interface SwaggerUIWrapperProps {
  spec: any;
}

export default function SwaggerUIWrapper({ spec }: SwaggerUIWrapperProps) {
  return (
    <div className="swagger-container">
      <SwaggerUI
        spec={spec}
        tryItOutEnabled={true}
        persistAuthorization={true}
        displayRequestDuration={true}
        docExpansion="list"
        defaultModelsExpandDepth={2}
        defaultModelExpandDepth={2}
        filter={true}
        showExtensions={true}
        showCommonExtensions={true}
      />
      <style jsx global>{`
        .swagger-container .swagger-ui {
          font-family: inherit;
        }
        
        .swagger-ui .topbar {
          display: none;
        }
        
        .swagger-ui .info {
          margin: 20px 0;
        }
        
        .swagger-ui .scheme-container {
          background: #fafafa;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 20px;
        }
        
        .swagger-ui .opblock.opblock-get {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.1);
        }
        
        .swagger-ui .opblock.opblock-post {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
        }
        
        .swagger-ui .opblock.opblock-put {
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
        }
        
        .swagger-ui .opblock.opblock-delete {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }
        
        .swagger-ui .opblock-summary-method {
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}