import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Prosper Desk API',
      version: '1.0.0',
      description: 'REST API for Prosper Desk support ticket management system',
      contact: {
        name: 'API Support',
        email: 'edgar.gago@useprosper.co'
      }
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication'
        }
      },
      schemas: {
        Ticket: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique ticket identifier'
            },
            subject: {
              type: 'string',
              description: 'Ticket subject/title'
            },
            description: {
              type: 'string',
              description: 'Detailed ticket description'
            },
            status: {
              type: 'string',
              enum: ['open', 'in_progress', 'resolved', 'closed'],
              description: 'Current ticket status'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Ticket priority level'
            },
            customer_email: {
              type: 'string',
              format: 'email',
              nullable: true,
              description: 'Customer email address'
            },
            customer_name: {
              type: 'string',
              nullable: true,
              description: 'Customer name'
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Ticket tags for categorization'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Ticket creation timestamp'
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        CreateTicket: {
          type: 'object',
          required: ['subject', 'description'],
          properties: {
            subject: {
              type: 'string',
              minLength: 1,
              description: 'Ticket subject/title'
            },
            description: {
              type: 'string',
              minLength: 1,
              description: 'Detailed ticket description'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              default: 'medium',
              description: 'Ticket priority level'
            },
            customer_email: {
              type: 'string',
              format: 'email',
              description: 'Customer email address'
            },
            customer_name: {
              type: 'string',
              description: 'Customer name'
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              default: [],
              description: 'Ticket tags for categorization'
            }
          }
        },
        UpdateTicket: {
          type: 'object',
          properties: {
            subject: {
              type: 'string',
              minLength: 1,
              description: 'Ticket subject/title'
            },
            description: {
              type: 'string',
              description: 'Detailed ticket description'
            },
            status: {
              type: 'string',
              enum: ['open', 'in_progress', 'resolved', 'closed'],
              description: 'Current ticket status'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Ticket priority level'
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Ticket tags for categorization'
            }
          }
        },
        Comment: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique comment identifier'
            },
            content: {
              type: 'string',
              description: 'Comment content'
            },
            is_internal: {
              type: 'boolean',
              description: 'Whether comment is internal or public'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Comment creation timestamp'
            }
          }
        },
        CreateComment: {
          type: 'object',
          required: ['content'],
          properties: {
            content: {
              type: 'string',
              minLength: 1,
              description: 'Comment content'
            },
            is_internal: {
              type: 'boolean',
              default: false,
              description: 'Whether comment is internal or public'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Ticket'
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'integer',
                  description: 'Current page number'
                },
                limit: {
                  type: 'integer',
                  description: 'Items per page'
                },
                total: {
                  type: 'integer',
                  description: 'Total number of items'
                },
                total_pages: {
                  type: 'integer',
                  description: 'Total number of pages'
                }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'object',
              description: 'Additional error details'
            }
          }
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      }
    ]
  },
  apis: [] // We'll define paths manually below
};

// Define API paths manually
const paths = {
  '/tickets': {
    get: {
      tags: ['Tickets'],
      summary: 'List tickets',
      description: 'Retrieve a paginated list of tickets with filtering options',
      parameters: [
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, default: 1 },
          description: 'Page number for pagination'
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
          description: 'Number of items per page'
        },
        {
          name: 'status',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['open', 'in_progress', 'resolved', 'closed']
          },
          description: 'Filter by ticket status'
        },
        {
          name: 'priority',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent']
          },
          description: 'Filter by ticket priority'
        },
        {
          name: 'search',
          in: 'query',
          schema: { type: 'string' },
          description: 'Search in ticket subject and description'
        }
      ],
      responses: {
        '200': {
          description: 'List of tickets',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PaginatedResponse'
              }
            }
          }
        },
        '400': {
          description: 'Invalid query parameters',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        '401': {
          description: 'Invalid or missing API key',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        '403': {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      }
    },
    post: {
      tags: ['Tickets'],
      summary: 'Create ticket',
      description: 'Create a new support ticket',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateTicket'
            }
          }
        }
      },
      responses: {
        '201': {
          description: 'Ticket created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    $ref: '#/components/schemas/Ticket'
                  }
                }
              }
            }
          }
        },
        '400': {
          description: 'Invalid request body',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        '401': {
          description: 'Invalid or missing API key'
        },
        '403': {
          description: 'Insufficient permissions'
        }
      }
    }
  },
  '/tickets/{id}': {
    get: {
      tags: ['Tickets'],
      summary: 'Get ticket by ID',
      description: 'Retrieve a specific ticket by its ID',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Ticket ID'
        }
      ],
      responses: {
        '200': {
          description: 'Ticket details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    $ref: '#/components/schemas/Ticket'
                  }
                }
              }
            }
          }
        },
        '404': {
          description: 'Ticket not found'
        }
      }
    },
    put: {
      tags: ['Tickets'],
      summary: 'Update ticket',
      description: 'Update an existing ticket',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Ticket ID'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateTicket'
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Ticket updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    $ref: '#/components/schemas/Ticket'
                  }
                }
              }
            }
          }
        },
        '400': {
          description: 'Invalid request body'
        },
        '404': {
          description: 'Ticket not found'
        }
      }
    },
    delete: {
      tags: ['Tickets'],
      summary: 'Delete ticket',
      description: 'Delete a ticket by ID',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Ticket ID'
        }
      ],
      responses: {
        '204': {
          description: 'Ticket deleted successfully'
        },
        '404': {
          description: 'Ticket not found'
        }
      }
    }
  },
  '/tickets/{id}/comments': {
    get: {
      tags: ['Comments'],
      summary: 'List ticket comments',
      description: 'Retrieve all comments for a specific ticket',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Ticket ID'
        }
      ],
      responses: {
        '200': {
          description: 'List of comments',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/Comment'
                    }
                  }
                }
              }
            }
          }
        },
        '404': {
          description: 'Ticket not found'
        }
      }
    },
    post: {
      tags: ['Comments'],
      summary: 'Add comment to ticket',
      description: 'Add a new comment to a specific ticket',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Ticket ID'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateComment'
            }
          }
        }
      },
      responses: {
        '201': {
          description: 'Comment created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    $ref: '#/components/schemas/Comment'
                  }
                }
              }
            }
          }
        },
        '400': {
          description: 'Invalid request body'
        },
        '404': {
          description: 'Ticket not found'
        }
      }
    }
  }
};

// Add paths to the definition
options.definition.paths = paths;

export const spec = swaggerJsdoc(options);
