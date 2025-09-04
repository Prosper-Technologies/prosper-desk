import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Simulate the Pub/Sub message format that Gmail would send
  const mockPubSubMessage = {
    message: {
      data: Buffer.from(
        JSON.stringify({
          emailAddress: "edgar.gago@useprosper.co",
          historyId: "12345",
        }),
      ).toString("base64"),
      messageId: "test-message-id",
      publishTime: new Date().toISOString(),
    },
  };

  console.log(
    "Mock Pub/Sub message:",
    JSON.stringify(mockPubSubMessage, null, 2),
  );

  return res.status(200).json({
    success: true,
    receivedBody: req.body,
    mockMessage: mockPubSubMessage,
  });
}
