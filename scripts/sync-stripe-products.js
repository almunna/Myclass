require('dotenv').config({ path: '.env.local' });

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function syncStripeProducts() {
  try {
    // Check if API key is available
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY not found in .env.local file');
      console.log('🔧 Make sure you have STRIPE_SECRET_KEY=sk_... in your .env.local file');
      process.exit(1);
    }

    console.log('🔄 Fetching Stripe products and prices...');
    
    // Fetch all products
    const products = await stripe.products.list({
      active: true,
      expand: ['data.default_price']
    });

    // Fetch all prices
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product']
    });

    console.log('\n📦 Found products:', products.data.length);
    console.log('💰 Found prices:', prices.data.length);

    if (products.data.length === 0) {
      console.log('\n⚠️  No active products found in Stripe.');
      console.log('💡 Make sure you have active products in your Stripe Dashboard');
      process.exit(0);
    }

    // Generate pricing plans array
    const pricingPlans = [];

    for (const product of products.data) {
      // Find prices for this product
      const productPrices = prices.data.filter(
        price => price.product.id === product.id
      );

      for (const price of productPrices) {
        const plan = {
          name: product.name,
          price: price.unit_amount / 100, // Convert cents to dollars
          description: product.description || "Complete student tracking solution",
          features: product.metadata.features ? 
            product.metadata.features.split(',').map(f => f.trim()) : 
            [
              "Unlimited students",
              "Advanced attendance tracking",
              "Detailed reports & analytics",
              "Export data (CSV)",
              "Multi-class management"
            ],
          stripePriceId: price.id,
          stripeProductId: product.id,
          currency: price.currency.toUpperCase(),
          interval: price.recurring?.interval || 'one_time',
          popular: product.metadata.popular === 'true'
        };
        pricingPlans.push(plan);
      }
    }

    console.log('\n🎯 Generated pricing plans:');
    console.log('Copy this array to your src/app/subscription/page.tsx file:\n');
    
    console.log('const pricingPlans = [');
    pricingPlans.forEach((plan, index) => {
      console.log('  {');
      console.log(`    name: "${plan.name}",`);
      console.log(`    price: ${plan.price},`);
      console.log(`    description: "${plan.description}",`);
      console.log(`    features: ${JSON.stringify(plan.features, null, 6).replace(/\n/g, '\n    ')},`);
      console.log(`    stripePriceId: "${plan.stripePriceId}",`);
      console.log(`    stripeProductId: "${plan.stripeProductId}",`);
      console.log(`    currency: "${plan.currency}",`);
      console.log(`    interval: "${plan.interval}",`);
      console.log(`    popular: ${plan.popular},`);
      console.log(`    icon: <Star className="h-5 w-5" />,`);
      console.log('  }' + (index < pricingPlans.length - 1 ? ',' : ''));
    });
    console.log('];');

    console.log('\n✅ Done! Copy the array above to your component.');
    console.log('\n💡 Pro tip: Add features to your Stripe product metadata as "features" field (comma-separated)');
    console.log('💡 Pro tip: Add "popular: true" to product metadata to mark as popular');

  } catch (error) {
    console.error('❌ Error fetching Stripe data:', error.message);
    console.log('\n🔧 Make sure you have STRIPE_SECRET_KEY in your .env.local file');
    console.log('🔧 Check that your Stripe API key is valid and has the correct permissions');
  }
}

syncStripeProducts(); 