<template>
  <q-table
    flat
    bordered
    table-header-class="bg-grey-2 text-grey-7"
    class="diagram-table"
    :rows="diagrams"
    :columns="columns"
    row-key="path"
    data-cy="diagram-table"
    @row-click="(_, row) => emit('click:diagram', row)"
  >
    <template #body-cell-categories="{ row: { tags } }">
      <q-td data-cy="diagram-categories">
        <q-chip
          v-for="(tag, index) in tags"
          :key="index"
          dense
          :outline="false"
          color="accent"
          text-color="white"
          :label="tag"
        />
      </q-td>
    </template>
    <template #body-cell-diagramPath="{ row: { name, path } }">
      <q-td :data-cy="`diagram-path_${path}`">
        <div>
          {{ name }}
        </div>
        <div class="text-grey">
          {{ path }}
        </div>
      </q-td>
    </template>
    <template #body-cell-pluginIcon="{ row: { plugin } }">
      <q-td>
        <q-img
          :src="`/plugins/${plugin}/icons/${plugin}.svg`"
          :alt="plugin"
          width="45px"
          height="45px"
        />
      </q-td>
    </template>
    <template #body-cell-actions="{ row }">
      <q-td @click.stop>
        <q-btn
          flat
          dense
          size="sm"
          icon="fa-solid fa-ellipsis"
          :data-cy="`diagram-actions_${row.path}`"
        >
          <q-tooltip
            anchor="center start"
            self="center right"
          >
            {{ $t('page.models.table.actionsTitle') }}
          </q-tooltip>
          <diagram-table-action-menu :diagram="row" />
        </q-btn>
      </q-td>
    </template>
    <template #no-data>
      <div
        class="text-subtitle2 text-grey"
        data-cy="diagram-table-empty"
      >
        {{ $t('page.models.empty') }}
      </div>
    </template>
  </q-table>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import DiagramTableActionMenu from 'src/components/menu/DiagramTableActionMenu.vue';

const { t } = useI18n();
const emit = defineEmits(['click:diagram']);

defineProps({
  diagrams: {
    type: Object,
    required: true,
  },
});

const columns = computed(() => [
  {
    name: 'categories',
    align: 'left',
    label: t('page.models.table.categories'),
    field: (row) => row.tags,
  },
  {
    name: 'diagramPath',
    align: 'left',
    label: t('page.models.table.diagramPath'),
    field: (row) => row.path,
    sortable: true,
  },
  {
    name: 'pluginIcon',
    align: 'left',
    label: t('page.models.table.plugin'),
    field: 'pluginIcon',
  },
  {
    name: 'actions',
    label: '',
    field: 'actions',
  },
]);
</script>
