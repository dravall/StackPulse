import { prismaClient } from "../index";

const REGIONS = ["us-east", "eu-west", "ap-south"];

async function main() {
    for (const name of REGIONS) {
        await prismaClient.region.upsert({
            where: { name },
            update: {},
            create: { name }
        });
    }
    console.log(`Seeded ${REGIONS.length} regions: ${REGIONS.join(", ")}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prismaClient.$disconnect();
    });
