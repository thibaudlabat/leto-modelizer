import {ComponentType} from "@/ELK/ExternalTypes";


export interface NodeData {
    parent: NodeData
    raw: ComponentType | null
    children: NodeData[]
    depth: number
}

export type NodeMap = Map<string, NodeData>;
