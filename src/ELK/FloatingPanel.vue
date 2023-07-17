<script setup>
import {onMounted} from "vue";

function enableDraggedElement()
{

  // Make the DIV element draggable:
  dragElement(document.getElementById("mydiv"));

  function dragElement(elmnt) {
    elmnt.style.top = "0px"
    elmnt.style.left = "0px";

    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (document.getElementById(elmnt.id + "header")) {
      // if present, the header is where you move the DIV from:
      // @ts-ignore
      document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
    } else {
      // otherwise, move the DIV from anywhere inside the DIV:
      elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // call a function whenever the cursor moves:
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // set the element's new position:
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
      // stop moving when mouse button is released:
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }
}

onMounted(async () => {
  enableDraggedElement();
});

const props = defineProps({
  title: {
    type: String,
    required: true
  }
});
</script>

<template>

  <div id="mydiv">
    <div id="mydivheader">{{props.title}}</div>
    <div id="mydivcontent">
      <slot></slot>
    </div>

  </div>


</template>

<style scoped>

#mydiv {
  position: absolute;
  z-index: 9999999;
  background-color: #f1f1f1;
  border: 1px solid #d3d3d3;
  text-align: center;
}

#mydivheader {
  padding: 5px;
  cursor: move;
  z-index: 999999901;
  background-color: #2196F3;
  color: #fff;
}

#mydivcontent {
  padding: 10px;
  margin: 10px;
}
</style>
