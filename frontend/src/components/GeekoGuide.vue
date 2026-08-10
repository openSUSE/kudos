<!--
  GeekoGuide — decorative mascot placed in the left gutter on wide screens.
  Drop it anywhere; it renders fixed, semi-transparent, and hides on narrow viewports.

  Props:
    pose    — filename of the image in /public/  (default: "gotkudo.png")
    top     — CSS top offset                     (default: "120px")
    opacity — CSS opacity value                  (default: 1)
-->

<template>
  <img
    :src="`${base}${pose}`"
    :style="{ top, opacity }"
    alt=""
    aria-hidden="true"
    class="geeko-guide"
  />
</template>

<script setup>
const base = import.meta.env.BASE_URL;

const props = defineProps({
  pose:    { type: String,  default: "geekoguide.png" },
  top:     { type: String,  default: "120px" },
  opacity: { type: Number,  default: 1 },
});
const { pose, top, opacity } = props;
</script>

<style scoped>
.geeko-guide {
  position: absolute;
  left: 34px;
  width: 141px;
  pointer-events: none;
  user-select: none;
  z-index: 2;
  filter: none;
  transform: translateX(0);
  mix-blend-mode: normal;
}

@media (max-width: 1220px) {
  .geeko-guide {
    width: 109px;
    transform: translateX(0);
  }
}

@media (max-width: 1100px) {
  .geeko-guide {
    display: none;
  }
}
</style>
