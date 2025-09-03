// Simple API testing script
// Run with: node test-api.js

const API_BASE = 'http://localhost:3000/api/v1';
const API_KEY = 'YOUR_API_KEY'; // Replace with actual API key

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};

async function testEndpoints() {
  console.log('🧪 Testing BlueDesk API Endpoints\n');

  try {
    // Test 1: List tickets
    console.log('1. Testing GET /tickets');
    const listResponse = await fetch(`${API_BASE}/tickets?limit=5`, {
      method: 'GET',
      headers
    });
    
    if (listResponse.ok) {
      const data = await listResponse.json();
      console.log('✅ GET /tickets - Success');
      console.log(`   Found ${data.data.length} tickets`);
      console.log(`   Pagination: Page ${data.pagination?.page || 1} of ${data.pagination?.total_pages || 1}`);
    } else {
      console.log(`❌ GET /tickets - Failed (${listResponse.status})`);
      const error = await listResponse.json();
      console.log(`   Error: ${error.error}`);
    }

    // Test 2: Create ticket
    console.log('\n2. Testing POST /tickets');
    const createResponse = await fetch(`${API_BASE}/tickets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subject: 'Test API Ticket',
        description: 'This is a test ticket created via API',
        priority: 'medium',
        customer_email: 'test@example.com',
        customer_name: 'Test User',
        tags: ['api', 'test']
      })
    });

    let ticketId = null;
    if (createResponse.ok) {
      const data = await createResponse.json();
      ticketId = data.data.id;
      console.log('✅ POST /tickets - Success');
      console.log(`   Created ticket: ${data.data.subject} (ID: ${ticketId})`);
    } else {
      console.log(`❌ POST /tickets - Failed (${createResponse.status})`);
      const error = await createResponse.json();
      console.log(`   Error: ${error.error}`);
    }

    // Test 3: Get single ticket (if we created one)
    if (ticketId) {
      console.log('\n3. Testing GET /tickets/:id');
      const getResponse = await fetch(`${API_BASE}/tickets/${ticketId}`, {
        method: 'GET',
        headers
      });

      if (getResponse.ok) {
        const data = await getResponse.json();
        console.log('✅ GET /tickets/:id - Success');
        console.log(`   Ticket: ${data.data.subject}`);
        console.log(`   Status: ${data.data.status}`);
        console.log(`   Priority: ${data.data.priority}`);
      } else {
        console.log(`❌ GET /tickets/:id - Failed (${getResponse.status})`);
        const error = await getResponse.json();
        console.log(`   Error: ${error.error}`);
      }

      // Test 4: Update ticket
      console.log('\n4. Testing PUT /tickets/:id');
      const updateResponse = await fetch(`${API_BASE}/tickets/${ticketId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          status: 'in_progress',
          priority: 'high'
        })
      });

      if (updateResponse.ok) {
        const data = await updateResponse.json();
        console.log('✅ PUT /tickets/:id - Success');
        console.log(`   Updated status to: ${data.data.status}`);
        console.log(`   Updated priority to: ${data.data.priority}`);
      } else {
        console.log(`❌ PUT /tickets/:id - Failed (${updateResponse.status})`);
        const error = await updateResponse.json();
        console.log(`   Error: ${error.error}`);
      }

      // Test 5: Add comment
      console.log('\n5. Testing POST /tickets/:id/comments');
      const commentResponse = await fetch(`${API_BASE}/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: 'This is a test comment added via API',
          customer_email: 'test@example.com',
          customer_name: 'Test User'
        })
      });

      if (commentResponse.ok) {
        const data = await commentResponse.json();
        console.log('✅ POST /tickets/:id/comments - Success');
        console.log(`   Added comment: ${data.data.content.substring(0, 50)}...`);
      } else {
        console.log(`❌ POST /tickets/:id/comments - Failed (${commentResponse.status})`);
        const error = await commentResponse.json();
        console.log(`   Error: ${error.error}`);
      }

      // Test 6: Get comments
      console.log('\n6. Testing GET /tickets/:id/comments');
      const commentsResponse = await fetch(`${API_BASE}/tickets/${ticketId}/comments`, {
        method: 'GET',
        headers
      });

      if (commentsResponse.ok) {
        const data = await commentsResponse.json();
        console.log('✅ GET /tickets/:id/comments - Success');
        console.log(`   Found ${data.data.length} comments`);
      } else {
        console.log(`❌ GET /tickets/:id/comments - Failed (${commentsResponse.status})`);
        const error = await commentsResponse.json();
        console.log(`   Error: ${error.error}`);
      }
    }

    console.log('\n🎉 API testing completed!');
    console.log('\n📝 Notes:');
    console.log('- Make sure to replace YOUR_API_KEY with an actual API key');
    console.log('- Ensure the development server is running on http://localhost:3000');
    console.log('- Some tests may fail if the database is not properly set up');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('- Development server is running');
    console.log('- Database is connected');
    console.log('- API key is valid');
  }
}

// Run tests if API_KEY is provided
if (API_KEY === 'YOUR_API_KEY') {
  console.log('⚠️  Please set a valid API_KEY in the test script');
  console.log('   You can generate one through the BlueDesk dashboard');
} else {
  testEndpoints();
}