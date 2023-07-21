<template>

<!-- ELK - Playground -->
  <floating-panel :title='"Placement automatique"'>
    <h5 style="margin: 0 0 5px;">Layout</h5>



    <button @click="buttonClick_layoutAuto()">Layout automatique</button><br/>
    <label for="interactiveCheckbox">Interactive</label>      <input id="interactiveCheckbox" type="checkbox" v-model="interactiveCheckbox"/> <br/>
    <label for="separateConnectedCheckbox">separateConnectedComponents</label>      <input id="separateConnectedCheckbox" type="checkbox" v-model="separateConnectedCheckbox"/> <br/>

    <label for="cycleBreaking">cycleBreaking</label>
    <select v-model="cycleBreaking" id="cycleBreaking">
      <option>GREEDY</option>
      <option>DEPTH_FIRST</option>
      <option>INTERACTIVE</option>
      <option>MODEL_ORDER</option>
      <option>GREEDY_MODEL_ORDER</option>
    </select><br/>

    <label for="layering">layering</label>
    <select v-model="layering" id="layering">
      <option>NETWORK_SIMPLEX</option>
      <option>LONGEST_PATH</option>
      <option>LONGEST_PATH_SOURCE</option>
      <option>COFFMAN_GRAHAM</option>
      <option>INTERACTIVE</option>
      <option>STRETCH_WIDTH</option>
      <option>MIN_WIDTH</option>
      <option>BF_MODEL_ORDER</option>
      <option>DF_MODEL_ORDER</option>
    </select><br/>

    <label for="crossingMinimization">crossingMinimization</label>
    <select v-model="crossingMinimization" id="crossingMinimization">
      <option>LAYER_SWEEP</option>
      <option>INTERACTIVE</option>
      <option>NONE</option>
    </select><br/>

    <label for="nodePlacement">nodePlacement</label>
    <select v-model="nodePlacement" id="nodePlacement">
      <option>SIMPLE</option>
      <option>INTERACTIVE</option>
      <option>LINEAR_SEGMENTS</option>
      <option>BRANDES_KOEPF</option>
      <option>NETWORK_SIMPLEX</option>
    </select><br/>

    <label for="interactiveReferencePoint">interactiveReferencePoint</label>
    <select v-model="interactiveReferencePoint" id="interactiveReferencePoint">
      <option>CENTER</option>
      <option>TOP_LEFT</option>
    </select><br/>


    <label for="direction">direction</label>
    <select v-model="direction" id="direction">
      <option>UNDEFINED</option>
      <option>RIGHT</option>
      <option>LEFT</option>
      <option>DOWN</option>
      <option>UP</option>
    </select><br/>

    <br/>

    <hr/>

    <h5 style="margin: 0 0 5px;">Debug</h5>
    <button @click="buttonClick_showELKLayout()">Logger layouts ELK purs</button><br/>
    <a target="_blank" href="https://rtsys.informatik.uni-kiel.de/elklive/json.html">ELKLive json playground</a><br/>

    <hr/>
    <h5 style="margin: 0 0 5px;">Auto node placement</h5>
    <label for="direction">iterations</label> <input id="iterations" type="number" v-model="placementAutoN"/><br/>
    <button @click="buttonClick_placementAutoNoeuds()">Replacer automatiquement les noeuds ignorés</button><br/>
    <button @click="buttonClick_algoForce()">Enlever overlap avec forces</button><br/>

  </floating-panel>


</template>

<script setup lang="ts">
import {AutoLayout} from './elk';
import {ref, onMounted} from "vue";
import FloatingPanel from "./FloatingPanel.vue";


const props = defineProps({
  plugin: {
    type: Object,
    required: true
  }
});


const interactiveCheckbox = ref(true)
const separateConnectedCheckbox = ref(true)

const cycleBreaking = ref("INTERACTIVE")
const layering = ref("INTERACTIVE")
const crossingMinimization = ref("LAYER_SWEEP")
const nodePlacement = ref("BRANDES_KOEPF")
const interactiveReferencePoint = ref("TOP_LEFT")
const direction = ref("UNDEFINED")
const placementAutoN = ref("5")

// DEBUG
import * as d3 from 'd3';
import PluginEvent from "../composables/events/PluginEvent";
// @ts-ignore
window.d3 = d3;
/*
d3.select("#root svg").selectAll("g .component").on("click", (evt,data,c) => d3.select(evt.target).style({backgroundColor:"red"})   )
 // d3.select(d).style({background:"red"})

 d3.select("#root svg").selectAll("g .component").on("click", (evt,data,c) => console.log({evt,data})   )

 d3.select("#root svg").selectAll("g .component").on("click", (evt,data,c) => d3.select(evt.target).attr('fill', 'red')   )


 */

function getElkUserParams()
{
  return {
    interactive: interactiveCheckbox.value,
    separateConnectedComponents: separateConnectedCheckbox.value,
    cycleBreaking: cycleBreaking.value,
    layering: layering.value,
    crossingMinimization: crossingMinimization.value,
    nodePlacement: nodePlacement.value,
    interactiveReferencePoint: interactiveReferencePoint.value,
    direction: direction.value
  };
}
async function buttonClick_layoutAuto()
{

  const layouts = await layout.generateLayouts(getElkUserParams())
  layout.drawLayouts(layouts);
  props.plugin.plugin.draw('root', false);
}

async function buttonClick_placementAutoNoeuds()
{
  const [layouts,score] = await layout.replacementAuto(getElkUserParams(),parseInt(placementAutoN.value,10))
  console.log("score",score);
  layout.drawLayouts(layouts);
  props.plugin.plugin.draw('root', false);
}
function buttonClick_showELKLayout()
{
  console.log(layout.renderedLayouts)
}

let layout = new AutoLayout( ()=>props.plugin.plugin );

async function buttonClick_algoForce()
{
  await layout.overlapForceAlgo();
  props.plugin.plugin.draw('root', false);
}


</script>

<style scoped>

</style>
