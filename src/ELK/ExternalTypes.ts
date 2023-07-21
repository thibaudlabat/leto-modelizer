import {ElkEdgeSection} from "elkjs";

interface ComponentDefinitionType{

}

interface ComponentDrawOptionType{
    x:number
    y:number
    height:number
    width:number
}
export interface ComponentAttributesType{
    name: string
    value:string
}
export interface ComponentType {
    __class : string;
    id : string|null;
    name: string|null;
    definition:ComponentDefinitionType|null;
    drawOption:ComponentDrawOptionType|null;
    attributes : ComponentAttributesType[];
    __ignored?: boolean; // extension perso
}

export interface ComponentType
{

}

export interface ComponentLinkType
{
    source: string
    target: string
}

export interface DefaultDataType
{
    __elkEdges? : Map<string, ElkEdgeSection>; // extension perso
    __elkNodesEdgesMap? : Map<string, string[]>; // extension perso
    components : ComponentType[]
    getLinks: ()=>ComponentLinkType
}
export interface DefaultPluginType{
    data: DefaultDataType
}
