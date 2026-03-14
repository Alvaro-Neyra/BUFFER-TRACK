export interface IDefaultStatusSeed {
    name: string;
    colorHex: string;
    isPPC: boolean;
}

export const DEFAULT_PROJECT_STATUSES: ReadonlyArray<IDefaultStatusSeed> = [
    {
        name: 'Pending',
        colorHex: '#F59E0B',
        isPPC: false,
    },
    {
        name: 'Completed',
        colorHex: '#10B981',
        isPPC: true,
    },
];
