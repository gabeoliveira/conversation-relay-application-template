/**
 * Test script for the outbound call endpoint
 *
 * Usage:
 *   node test-outbound-call.js
 *
 * Make sure to update the BASE_URL with your actual domain
 */

const BASE_URL = 'http://localhost:3000'; // Update this with your domain

// Example 1: Basic call (no custom parameters)
async function testBasicCall() {
  console.log('\n=== Test 1: Basic Call (No Custom Parameters) ===');

  const response = await fetch(`${BASE_URL}/api/outbound-call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: '+15558675310' // Replace with actual test number
    })
  });

  const result = await response.json();
  console.log('Response Status:', response.status);
  console.log('Call Response:', JSON.stringify(result, null, 2));
}

// Example 2: Call with custom parameters
async function testCallWithCustomParameters() {
  console.log('\n=== Test 2: Call with Custom Parameters ===');

  const response = await fetch(`${BASE_URL}/api/outbound-call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: '+15558675310', // Replace with actual test number
      customParameters: {
        customerName: 'John Doe',
        accountId: 'ACC123456',
        callReason: 'Account verification',
        priority: 'high',
        ticketId: 'TICKET-789'
      }
    })
  });

  const result = await response.json();
  console.log('Response Status:', response.status);
  console.log('Call Response:', JSON.stringify(result, null, 2));
}

// Example 3: Customer service call
async function testCustomerServiceCall() {
  console.log('\n=== Test 3: Customer Service Call ===');

  const response = await fetch(`${BASE_URL}/api/outbound-call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: '+15558675310', // Replace with actual test number
      customParameters: {
        callType: 'customer_service',
        customerName: 'Jane Smith',
        accountNumber: '12345',
        issueType: 'billing_inquiry',
        lastInteractionDate: '2025-11-28'
      }
    })
  });

  const result = await response.json();
  console.log('Response Status:', response.status);
  console.log('Call Response:', JSON.stringify(result, null, 2));
}

// Example 4: Appointment reminder call
async function testAppointmentReminderCall() {
  console.log('\n=== Test 4: Appointment Reminder Call ===');

  const response = await fetch(`${BASE_URL}/api/outbound-call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: '+15558675310', // Replace with actual test number
      customParameters: {
        callType: 'appointment_reminder',
        customerName: 'Robert Johnson',
        appointmentDate: '2025-12-05',
        appointmentTime: '14:30',
        appointmentType: 'dental_checkup'
      }
    })
  });

  const result = await response.json();
  console.log('Response Status:', response.status);
  console.log('Call Response:', JSON.stringify(result, null, 2));
}

// Example 5: Make an actual outbound call using Twilio
async function makeActualOutboundCall() {
  console.log('\n=== Test 5: Making Actual Outbound Call with Twilio ===');

  // You'll need to install twilio: npm install twilio
  // Uncomment and configure this section to test actual calls

  /*
  const twilio = require('twilio');
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = twilio(accountSid, authToken);

  try {
    const call = await client.calls.create({
      url: `${BASE_URL}/api/outbound-call`,
      to: '+1234567890',  // Replace with destination number
      from: '+0987654321', // Replace with your Twilio number
      method: 'POST',
      machineDetection: 'Enable',
      statusCallback: `${BASE_URL}/api/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });

    console.log('Call initiated successfully!');
    console.log('Call SID:', call.sid);
    console.log('Status:', call.status);
  } catch (error) {
    console.error('Error making call:', error.message);
  }
  */

  console.log('Uncomment and configure the code above to test actual calls');
}

// Run all tests
async function runAllTests() {
  try {
    await testBasicCall();
    await testCallWithCustomParameters();
    await testCustomerServiceCall();
    await testAppointmentReminderCall();
    await makeActualOutboundCall();

    console.log('\n=== All Tests Completed ===\n');
  } catch (error) {
    console.error('Error running tests:', error.message);
  }
}

// Run the tests
runAllTests();
