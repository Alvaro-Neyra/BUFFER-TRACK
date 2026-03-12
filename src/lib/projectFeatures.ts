interface IProjectFeaturesLike {
    configuration?: {
        features?: {
            redList?: {
                enabled?: boolean;
            };
        };
    };
}

/**
 * Feature flag resolver with backward-compatible default.
 * Existing projects without feature config keep Red List enabled.
 */
export function isRedListEnabled(project: IProjectFeaturesLike | null | undefined): boolean {
    return project?.configuration?.features?.redList?.enabled ?? true;
}

export function isRestrictedStatus(status: string): boolean {
    return status.trim().toLowerCase() === "restricted";
}