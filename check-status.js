const http = require('http');

function checkServer(port, name) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      console.log(`✅ ${name} is running on port ${port} (Status: ${res.statusCode})`);
      resolve(true);
    });

    req.on('error', () => {
      console.log(`❌ ${name} is not responding on port ${port}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`⏰ ${name} timeout on port ${port}`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function checkStatus() {
  console.log('🔍 Checking AgriTrade application status...\n');
  
  await checkServer(3000, 'Backend API Server');
  await checkServer(8081, 'React Native Metro Bundler');
  
  console.log('\n📱 To run the mobile app on Android:');
  console.log('   cd AgriTradeMobile && npm run android');
  console.log('\n🌐 Backend API Documentation:');
  console.log('   http://localhost:3000/docs');
}

checkStatus();