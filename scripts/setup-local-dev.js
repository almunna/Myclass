#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Student Tracker for local development...\n');

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
const envExists = fs.existsSync(envPath);

if (!envExists) {
    console.log('📝 Creating .env.local template...');
    
    const envTemplate = `# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Stripe Configuration (Test Mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Firebase Admin SDK (for server-side operations)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account_email
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nyour_private_key\\n-----END PRIVATE KEY-----\\n"
`;

    fs.writeFileSync(envPath, envTemplate);
    console.log('✅ Created .env.local template');
    console.log('📋 Please fill in your actual values in .env.local\n');
} else {
    console.log('✅ .env.local already exists\n');
}

// Check next.config.ts
const nextConfigPath = path.join(process.cwd(), 'next.config.ts');
const nextConfig = fs.readFileSync(nextConfigPath, 'utf8');

if (nextConfig.includes("output: 'export'") && !nextConfig.includes("// output: 'export'")) {
    console.log('⚠️  Warning: Static export is enabled in next.config.ts');
    console.log('   This will disable API routes needed for Stripe payments.');
    console.log('   The setup has already commented it out for local development.\n');
}

// Check required environment variables
console.log('🔍 Checking environment setup...');

require('dotenv').config({ path: '.env.local' });

const requiredVars = [
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
];

let missingVars = 0;
requiredVars.forEach(varName => {
    if (!process.env[varName] || process.env[varName].includes('your_')) {
        console.log(`❌ ${varName} not configured`);
        missingVars++;
    } else {
        console.log(`✅ ${varName} configured`);
    }
});

console.log('\n📋 Next Steps:');

if (missingVars > 0) {
    console.log('1. 🔧 Configure missing environment variables in .env.local');
    console.log('2. 📊 Set up Stripe products in your dashboard');
    console.log('3. 🔄 Run: npm run sync-stripe');
    console.log('4. 🚀 Run: npm run dev');
    console.log('5. 🔗 In another terminal: stripe listen --forward-to localhost:3000/api/stripe-webhook');
} else {
    console.log('1. 📊 Ensure Stripe products are set up in your dashboard');
    console.log('2. 🔄 Run: npm run sync-stripe');
    console.log('3. 🚀 Run: npm run dev');
    console.log('4. 🔗 In another terminal: stripe listen --forward-to localhost:3000/api/stripe-webhook');
}

console.log('\n📖 For detailed setup instructions, see LOCAL_DEVELOPMENT_SETUP.md');
console.log('🎯 Test payments at: http://localhost:3000/subscription');
console.log('💳 Use test card: 4242 4242 4242 4242\n');

console.log('🎉 Setup complete! Happy coding!'); 