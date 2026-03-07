import { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// Notice this file doesn't import mongoose or any Node.js specific libraries directly
// This makes it safe for the Edge middleware.
export default {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const email = credentials.email as string;
                const password = credentials.password as string;

                // 1. Normal User Authentication (Must bypass Mongoose in Edge)
                // In NextAuth v5, authorize WILL run in the Edge runtime if middleware triggers it.
                // We use the REST API internally or fetch to verify the user without bringing Mongoose in.
                try {
                    // Assuming we are on the same server, we hit an internal API route that IS allowed to use Node APIs
                    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                    const res = await fetch(`${baseUrl}/api/auth/verify`, {
                        method: 'POST',
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, password })
                    });

                    if (res.ok) {
                        const json = await res.json();
                        // The verify route now returns { success: true, data: { id, name, ... } }
                        return json.data ?? json;
                    }
                } catch (error) {
                    console.error("Auth verification failed:", error);
                }

                return null;
            }
        })
    ],
} satisfies NextAuthConfig;