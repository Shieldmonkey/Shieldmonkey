export interface Metadata {
    name: string;
    namespace?: string;
    version?: string;
    author?: string;
    description?: string;
    homepage?: string;
    homepageURL?: string;
    website?: string;
    source?: string;
    icon?: string;
    iconURL?: string;
    defaulticon?: string;
    icon64?: string;
    icon64URL?: string;
    updateURL?: string;
    downloadURL?: string;
    installURL?: string;
    supportURL?: string;
    include: string[];
    match: string[];
    exclude: string[];
    require: string[];
    resource: { name: string; url: string }[];
    connect: string[];
    grant: string[];
    "run-at"?: string;
    noframes?: boolean;
    unwrap?: boolean;
    [key: string]: any;
}

export function parseMetadata(code: string): Metadata {
    const metadata: Metadata = {
        name: "New Script",
        include: [],
        match: [],
        exclude: [],
        require: [],
        resource: [],
        connect: [],
        grant: [],
    };

    const regex = /\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/m;
    const match = code.match(regex);

    if (!match) return metadata;

    const metadataBlock = match[1];
    const lines = metadataBlock.split('\n');
    const keyValRegex = /\/\/\s*@(\w+)(?:\s+(.*))?/;

    for (const line of lines) {
        const kvMatch = line.match(keyValRegex);
        if (!kvMatch) continue;

        const key = kvMatch[1].trim();
        const value = kvMatch[2] ? kvMatch[2].trim() : "";

        switch (key) {
            case "name":
            case "namespace":
            case "version":
            case "author":
            case "description":
            case "homepage":
            case "homepageURL":
            case "website":
            case "source":
            case "icon":
            case "iconURL":
            case "defaulticon":
            case "icon64":
            case "icon64URL":
            case "updateURL":
            case "downloadURL":
            case "installURL":
            case "supportURL":
            case "run-at":
                metadata[key] = value;
                break;
            case "include":
            case "match":
            case "exclude":
            case "require":
            case "connect":
            case "grant":
                if (value) metadata[key].push(value);
                break;
            case "resource":
                const parts = value.split(/\s+/);
                if (parts.length >= 2) {
                    metadata.resource.push({ name: parts[0], url: parts.slice(1).join(" ") });
                }
                break;
            case "noframes":
                metadata.noframes = true;
                break;
            case "unwrap":
                metadata.unwrap = true;
                break;
            default:
                // Handle custom or unknown keys?
                break;
        }
    }

    return metadata;
}
