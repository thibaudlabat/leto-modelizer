import {ComponentType} from "@/ELK/ExternalTypes";


export interface NodeData {
    parent: NodeData
    raw: ComponentType | null
    children: NodeData[]
    depth: number
}

export type NodeMap = Map<string, NodeData>;


export interface ELKParams {
    separateConnectedComponents: boolean;
    interactive: boolean
    "cycleBreaking": string//"INTERACTIVE",
    "layering": string//"INTERACTIVE",
    'crossingMinimization': string//'INTERACTIVE',
    'nodePlacement': string//'INTERACTIVE',
    'interactiveReferencePoint': string//'TOP_LEFT',
    'direction': string//'UNDEFINED'
}
