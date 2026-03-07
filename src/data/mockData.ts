export const mockTasks = [
    {
        id: "1",
        teamName: "Structural Team",
        teamInitials: "ST",
        teamColor: "purple",
        title: "Concrete pour foundation",
        status: {
            label: "3 days overdue",
            type: "danger"
        },
        location: "BLD-02 • Basement",
        dateLabel: "Oct 21",
        isOverdue: true
    },
    {
        id: "2",
        teamName: "MEP Contractor",
        teamInitials: "MC",
        teamColor: "blue",
        title: "Install HVAC ductwork",
        status: {
            label: "2 days left",
            type: "warning"
        },
        location: "BLD-01 • Level 2",
        dateLabel: "Oct 26",
        isOverdue: false
    }
];

export const mockCalendarDays = [
    { day: "Mon", date: "16", active: true, dots: ["hvac", "purple-500"] },
    { day: "Tue", date: "17", active: false, dots: [] },
    { day: "Wed", date: "18", active: false, dots: ["warning"] },
    { day: "Thu", date: "19", active: false, dots: [] },
    { day: "Fri", date: "20", active: false, dots: ["success"] },
    { day: "Sat", date: "21", active: false, dots: [], muted: true },
    { day: "Sun", date: "22", active: false, dots: [], muted: true }
];

export const mockNextWeekDays = [
    { day: "Mon", date: "23", active: false, dots: [] },
    { day: "Tue", date: "24", active: false, dots: [] },
    { day: "Wed", date: "25", active: false, dots: [] },
    { day: "Thu", date: "26", active: false, dots: [] },
    { day: "Fri", date: "27", active: false, dots: [] },
    { day: "Sat", date: "28", active: false, dots: [], muted: true },
    { day: "Sun", date: "29", active: false, dots: [], muted: true }
];

export const mockKPIs = {
    globalPPC: {
        value: "85%",
        trend: "+2%",
        isUp: true
    },
    activeRestrictions: {
        value: "12",
        trend: "-3",
        isUp: false
    },
    totalPendingTasks: {
        value: "45",
        trend: "-5",
        isUp: false
    },
    projectName: "Phase 1 Development"
};
