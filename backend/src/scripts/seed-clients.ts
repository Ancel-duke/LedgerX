import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mockClients = [
  {
    name: 'Acme Corporation',
    email: 'contact@acmecorp.com',
    phone: '+1-555-0101',
    address: '123 Business Street',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    country: 'USA',
    taxId: 'TAX-ACME-001',
    isActive: true,
  },
  {
    name: 'TechStart Inc.',
    email: 'info@techstart.io',
    phone: '+1-555-0102',
    address: '456 Innovation Drive',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94102',
    country: 'USA',
    taxId: 'TAX-TECH-002',
    isActive: true,
  },
  {
    name: 'Global Solutions Ltd.',
    email: 'hello@globalsolutions.com',
    phone: '+1-555-0103',
    address: '789 Enterprise Avenue',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60601',
    country: 'USA',
    taxId: 'TAX-GLOBAL-003',
    isActive: true,
  },
  {
    name: 'Digital Dynamics',
    email: 'contact@digitaldynamics.net',
    phone: '+1-555-0104',
    address: '321 Tech Boulevard',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    country: 'USA',
    taxId: 'TAX-DIGITAL-004',
    isActive: true,
  },
  {
    name: 'Premier Services Group',
    email: 'info@premierservices.com',
    phone: '+1-555-0105',
    address: '654 Service Road',
    city: 'Boston',
    state: 'MA',
    zipCode: '02101',
    country: 'USA',
    taxId: 'TAX-PREMIER-005',
    isActive: true,
  },
  {
    name: 'Creative Agency Co.',
    email: 'hello@creativeagency.co',
    phone: '+1-555-0106',
    address: '987 Design Street',
    city: 'Los Angeles',
    state: 'CA',
    zipCode: '90001',
    country: 'USA',
    taxId: 'TAX-CREATIVE-006',
    isActive: true,
  },
  {
    name: 'Manufacturing Partners',
    email: 'contact@manufacturingpartners.com',
    phone: '+1-555-0107',
    address: '147 Industrial Way',
    city: 'Detroit',
    state: 'MI',
    zipCode: '48201',
    country: 'USA',
    taxId: 'TAX-MANUF-007',
    isActive: true,
  },
  {
    name: 'Retail Ventures LLC',
    email: 'info@retailventures.com',
    phone: '+1-555-0108',
    address: '258 Commerce Lane',
    city: 'Seattle',
    state: 'WA',
    zipCode: '98101',
    country: 'USA',
    taxId: 'TAX-RETAIL-008',
    isActive: true,
  },
];

async function seedClients() {
  try {
    console.log('🌱 Starting client seed...');

    // Get ALL active organizations
    const organizations = await prisma.organization.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
    });

    if (organizations.length === 0) {
      console.error('❌ No active organization found. Please create an organization first.');
      process.exit(1);
    }

    console.log(`📦 Found ${organizations.length} organization(s). Seeding clients to all...`);

    // Seed clients to each organization
    for (const organization of organizations) {
      console.log(`\n📋 Processing organization: ${organization.name} (${organization.id})`);

      // Check existing clients
      const existingClients = await prisma.client.findMany({
        where: {
          organizationId: organization.id,
          deletedAt: null,
        },
      });

      if (existingClients.length > 0) {
        console.log(`   ⚠️  Found ${existingClients.length} existing clients. Skipping this organization.`);
        continue;
      }

      // Create mock clients for this organization
      const createdClients = [];
      for (const clientData of mockClients) {
        const client = await prisma.client.create({
          data: {
            ...clientData,
            organizationId: organization.id,
          },
        });
        createdClients.push(client);
        console.log(`   ✅ Created client: ${client.name}`);
      }

      console.log(`   🎉 Seeded ${createdClients.length} clients to ${organization.name}`);
    }

    console.log(`\n✨ Seed completed for all organizations!`);
  } catch (error) {
    console.error('❌ Error seeding clients:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedClients()
  .then(() => {
    console.log('✨ Seed completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seed failed:', error);
    process.exit(1);
  });
