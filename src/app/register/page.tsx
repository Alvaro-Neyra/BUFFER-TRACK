import React from "react";
import dbConnect from "@/lib/mongodb";
import Specialty from "@/models/Specialty";
import { RegisterView } from "./RegisterView";

export default async function RegisterPage() {
    await dbConnect();

    // Fetch available specialties to pass down to the client component
    // We sort them alphabetically for better readability
    const specialtiesDb = await Specialty.find({}).sort({ name: 1 }).select('_id name').lean();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const specialties = specialtiesDb.map((s: any) => ({
        id: s._id.toString(),
        name: s.name as string
    }));

    return <RegisterView specialties={specialties} />;
}
