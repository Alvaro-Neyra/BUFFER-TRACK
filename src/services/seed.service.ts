// ------------------------------------------------------------------
// Seed Service — Business Logic Layer
// Pattern: Service Layer
// Why: Extracts database seeding logic from the API route into a
//      testable service. The route becomes a thin HTTP wrapper.
// ------------------------------------------------------------------

import { ProjectRepository } from '@/repositories/project.repository';
import { BuildingRepository } from '@/repositories/building.repository';
import { SpecialtyRepository } from '@/repositories/specialty.repository';
import { UserRepository } from '@/repositories/user.repository';
import { roleRepository } from '@/repositories/role.repository';
import { ROLES, isManagerRole } from '@/constants/roles';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/** Result of a seed operation. */
interface ISeedResult {
    buildingsCount: number;
    specialtiesCount: number;
    projectName: string;
    adminEmailCreated: string | null;
}

export class SeedService {
    /**
     * Seed the database with default project, buildings, specialties,
     * and an admin user (from env variables).
     */
    static async seedDatabase(): Promise<ISeedResult> {
        // 1. Ensure a default project exists
        let project = await ProjectRepository.findFirst();
        if (!project) {
            project = await ProjectRepository.create({
                name: 'BufferTrack Default Project',
                code: 'PRJ-01',
                description: 'Initial project for master plan hotspots',
                address: '123 Next Ave',
                status: 'Active',
                connectionCode: 'BufferTrack-123456',
                configuration: {
                    startWeek: new Date(),
                    endWeek: new Date(new Date().setMonth(new Date().getMonth() + 6)),
                },
            });
        }

        // 2. Re-seed buildings (clear old ones first)
        await BuildingRepository.deleteByProjectId(project._id.toString());

        const buildings = [
            { projectId: project._id, name: 'Main Tower', code: 'BLD-01', number: 1, coordinates: { xPercent: 25, yPercent: 30 } },
            { projectId: project._id, name: 'North Wing', code: 'BLD-02', number: 2, coordinates: { xPercent: 55, yPercent: 45 } },
            { projectId: project._id, name: 'East Wing', code: 'BLD-03', number: 3, coordinates: { xPercent: 50, yPercent: 40 } },
            { projectId: project._id, name: 'South Annex', code: 'BLD-04', number: 4, coordinates: { xPercent: 35, yPercent: 65 } },
            { projectId: project._id, name: 'West Pavilion', code: 'BLD-05', number: 5, coordinates: { xPercent: 40, yPercent: 50 } },
            { projectId: project._id, name: 'Central Hub', code: 'BLD-06', number: 6, coordinates: { xPercent: 30, yPercent: 55 } },
            { projectId: project._id, name: 'Logistic Center', code: 'BLD-07', number: 7, coordinates: { xPercent: 15, yPercent: 70 } },
        ];

        const insertedBuildings = await BuildingRepository.createMany(buildings);

        // 3. Seed specialties (idempotent — skips existing ones)
        const specialtyNames = [
            'HVAC', 'Plumbing', 'Fire Protection', 'GAS', 'LV', 'ELV',
            'Lutron', 'Pools', 'Lifts', 'Drywall Framing', 'Drywall Boarding',
            'Tiles & Stones', 'Painting', 'Structures', 'Roofing',
            'Glazing', 'Topography', 'Design',
        ];

        const existingSpecialties = await SpecialtyRepository.findByProjectId(project._id.toString());
        const existingNames = existingSpecialties.map((s) => s.name);

        const specialtiesToCreate = specialtyNames
            .filter((name) => !existingNames.includes(name))
            .map((name, index) => {
                const hue = Math.floor((index * 137.5) % 360);
                const colorHex = `hsl(${hue}, 70%, 50%)`;
                return { projectId: project._id, name, colorHex };
            });

        let specialtiesCount = existingSpecialties.length;
        if (specialtiesToCreate.length > 0) {
            const inserted = await SpecialtyRepository.createMany(specialtiesToCreate);
            specialtiesCount += inserted.length;
        }

        // 4. Seed default roles per project (idempotent)
        const existingRoles = await roleRepository.getByProjectId(project._id.toString());
        const existingRoleNames = new Set(existingRoles.map((role) => role.name));

        for (const roleName of ROLES) {
            if (existingRoleNames.has(roleName)) continue;
            await roleRepository.create({
                projectId: new mongoose.Types.ObjectId(project._id.toString()),
                name: roleName,
                isManager: isManagerRole(roleName),
                specialtiesIds: [],
            });
        }

        const specialtiesInProject = await SpecialtyRepository.findByProjectId(project._id.toString());
        const subcontractorRole = await roleRepository.findByNameInProject('Subcontractor', project._id.toString());

        if (subcontractorRole) {
            const targetSpecialtyIds = specialtiesInProject.map(
                (specialty) => new mongoose.Types.ObjectId(specialty._id.toString())
            );

            const currentIds = new Set((subcontractorRole.specialtiesIds || []).map((id) => id.toString()));
            const targetIds = new Set(targetSpecialtyIds.map((id) => id.toString()));
            const needsSync =
                currentIds.size !== targetIds.size || [...targetIds].some((id) => !currentIds.has(id));

            if (needsSync) {
                await roleRepository.update(subcontractorRole._id.toString(), {
                    specialtiesIds: targetSpecialtyIds,
                });
            }
        }

        // 5. Seed admin user from environment variables
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        let adminEmailCreated: string | null = null;

        if (adminEmail && adminPassword) {
            const existingAdmin = await UserRepository.findByEmail(adminEmail);
            if (!existingAdmin) {
                const hashedPassword = await bcrypt.hash(adminPassword, 10);
                const admin = await UserRepository.create({
                    name: 'System Administrator',
                    email: adminEmail,
                    password: hashedPassword,
                    role: 'Admin',
                    projects: [{ projectId: project._id, status: 'Active' }],
                });
                adminEmailCreated = admin.email;
            }
        }

        return {
            buildingsCount: insertedBuildings.length,
            specialtiesCount,
            projectName: project.name,
            adminEmailCreated,
        };
    }
}
