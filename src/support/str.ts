export function plural(str: string): string {
    if (!str) {
        return "";
    }
    // Very basic pluralization implementation (just adds 's')
    // In a real scenario, we would use a library or more robust implementation
    if (str.endsWith("s")) {
        return str;
    }
    if (str.endsWith("y")) {
        return `${str.slice(0, -1)}ies`;
    }
    return `${str}s`;
}

export function snake(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}
