export function getSpecialtyIcon(specialtyName: string): string {
    const name = specialtyName.toLowerCase();

    if (name.includes('hvac')) return 'mode_fan';
    if (name.includes('plumbing')) return 'plumbing';
    if (name.includes('fire')) return 'fire_extinguisher';
    if (name.includes('gas')) return 'local_fire_department';
    if (name.includes('electrical') || name === 'lv' || name === 'elv') return 'bolt';
    if (name.includes('lutron')) return 'lightbulb';
    if (name.includes('pool')) return 'pool';
    if (name.includes('lift') || name.includes('elevator')) return 'elevator';
    if (name.includes('drywall')) return 'view_quilt';
    if (name.includes('tile') || name.includes('stone')) return 'grid_on';
    if (name.includes('paint')) return 'format_paint';
    if (name.includes('structure')) return 'foundation';
    if (name.includes('roof')) return 'roofing';
    if (name.includes('glazing') || name.includes('glass')) return 'window';
    if (name.includes('topo')) return 'terrain';
    if (name.includes('design') || name.includes('arch')) return 'architecture';

    return 'task_alt'; // Default
}
