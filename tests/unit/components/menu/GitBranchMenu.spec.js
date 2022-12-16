import DialogEvent from 'src/composables/events/DialogEvent';
import { shallowMount } from '@vue/test-utils';
import GitBranchMenu from 'components/menu/GitBranchMenu';
import { useRoute } from 'vue-router';
import { getBranches } from 'src/composables/Project';
import Branch from 'src/models/git/Branch';
import { createI18n } from 'vue-i18n';
import i18nConfiguration from 'src/i18n';
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-jest';
import GitEvent from 'src/composables/events/GitEvent';

installQuasarPlugin();

jest.mock('vue-router', () => ({
  useRoute: jest.fn(),
}));

jest.mock('src/composables/events/GitEvent', () => ({
}));

jest.mock('src/composables/Project', () => ({
  getCurrentBranch: jest.fn(() => Promise.resolve('main')),
  getBranches: jest.fn(() => Promise.resolve([])),
  fetchGit: jest.fn(() => Promise.resolve()),
  getProjectById: jest.fn(),
}));

describe('Test component: GitBranchMenu', () => {
  let wrapper;

  useRoute.mockImplementation(() => ({
    params: {
      projectName: 'project-00000000',
      viewType: 'model',
    },
  }));

  beforeEach(() => {
    wrapper = shallowMount(GitBranchMenu, {
      props: {
        currentBranchName: 'main',
      },
      global: {
        plugins: [
          createI18n({ locale: 'en-US', messages: i18nConfiguration }),
        ],
      },
    });
    wrapper.vm.menu = {
      hide: jest.fn(),
    };
  });

  describe('Test computed', () => {
    describe('Test computed: hasNoBranches', () => {
      it('should be true without local and remote branches', () => {
        wrapper.vm.filteredBranches.local = [];
        wrapper.vm.filteredBranches.remote = [];

        expect(wrapper.vm.hasNoBranches).toEqual(true);
      });
      it('should be false with local branches', () => {
        wrapper.vm.filteredBranches.local = [1];
        wrapper.vm.filteredBranches.remote = [];

        expect(wrapper.vm.hasNoBranches).toEqual(false);
      });
      it('should be false with remote branches', () => {
        wrapper.vm.filteredBranches.local = [];
        wrapper.vm.filteredBranches.remote = [1];

        expect(wrapper.vm.hasNoBranches).toEqual(false);
      });
      it('should be false with local and remote branches', () => {
        wrapper.vm.filteredBranches.local = [1];
        wrapper.vm.filteredBranches.remote = [1];

        expect(wrapper.vm.hasNoBranches).toEqual(false);
      });
    });
  });

  describe('Test functions', () => {
    describe('Test function: openDialog', () => {
      it('should call dialog event with the given key and hide menu', () => {
        DialogEvent.next = jest.fn();
        wrapper.vm.menu = {
          hide: jest.fn(),
        };

        wrapper.vm.openDialog('GitStatus');
        expect(DialogEvent.next).toHaveBeenCalledWith(({ key: 'GitStatus', branch: 'main', type: 'open' }));
        expect(wrapper.vm.menu.hide).toBeCalled();
      });
    });

    describe('Test function: isSearched', () => {
      it('should return true on match', () => {
        wrapper.vm.searchBranch = '';
        expect(wrapper.vm.isSearched('test')).toEqual(true);

        wrapper.vm.searchBranch = 's';
        expect(wrapper.vm.isSearched('test')).toEqual(true);

        wrapper.vm.searchBranch = 'a test';
        expect(wrapper.vm.isSearched('test')).toEqual(true);
      });
    });

    describe('Test function: filter', () => {
      it('should set branches correctly', () => {
        wrapper.vm.searchBranch = '';
        expect(wrapper.vm.isSearched('test')).toEqual(true);

        wrapper.vm.searchBranch = 's';
        expect(wrapper.vm.isSearched('test')).toEqual(true);

        wrapper.vm.searchBranch = 'a test';
        expect(wrapper.vm.isSearched('test')).toEqual(true);
      });
    });

    describe('Test function: openCloseExpandMenu', () => {
      const local = new Branch({
        name: 'Local',
        onLocal: true,
        onRemote: false,
      });
      const remote = new Branch({
        name: 'remote',
        onLocal: false,
        onRemote: true,
      });
      const both = new Branch({
        name: 'both',
        onLocal: true,
        onRemote: true,
      });

      it('should invert local value', () => {
        expect(wrapper.vm.showLocal).toEqual(false);
        expect(wrapper.vm.showRemote).toEqual(false);

        wrapper.vm.openCloseExpandMenu(true);
        expect(wrapper.vm.showLocal).toEqual(true);
        expect(wrapper.vm.showRemote).toEqual(false);

        wrapper.vm.openCloseExpandMenu(true);
        expect(wrapper.vm.showLocal).toEqual(false);
        expect(wrapper.vm.showRemote).toEqual(false);
      });

      it('should return all sorted branches without filter', async () => {
        getBranches.mockImplementation(() => Promise.resolve([
          local,
          remote,
          both,
        ]));
        await wrapper.vm.initBranches();
        wrapper.vm.filter();
        expect(wrapper.vm.filteredBranches)
          .toEqual({
            local: [both, local],
            remote: [both, remote],
          });
      });

      it('should return filtered branches', async () => {
        wrapper.vm.searchedBranch = 'both';
        getBranches.mockImplementation(() => Promise.resolve([
          local,
          remote,
          both,
        ]));
        await wrapper.vm.initBranches();
        wrapper.vm.filter();
        expect(wrapper.vm.filteredBranches)
          .toEqual({
            local: [both],
            remote: [both],
          });
      });
    });

    describe('Test function: onOpenMenu', () => {
      it('should call focus and close expand menu', () => {
        const focus = jest.fn();
        wrapper.vm.searchInput = { focus };
        wrapper.vm.showLocal = true;
        wrapper.vm.showRemote = true;
        wrapper.vm.onOpenMenu();
        expect(focus).toBeCalled();
        expect(wrapper.vm.showLocal).toEqual(false);
        expect(wrapper.vm.showRemote).toEqual(false);
      });
    });

    describe('Test function: openCloseExpandMenu', () => {
      it('should invert local value', () => {
        expect(wrapper.vm.showLocal).toEqual(false);
        expect(wrapper.vm.showRemote).toEqual(false);

        wrapper.vm.openCloseExpandMenu(true);
        expect(wrapper.vm.showLocal).toEqual(true);
        expect(wrapper.vm.showRemote).toEqual(false);

        wrapper.vm.openCloseExpandMenu(true);
        expect(wrapper.vm.showLocal).toEqual(false);
        expect(wrapper.vm.showRemote).toEqual(false);
      });

      it('should invert remote value', () => {
        expect(wrapper.vm.showLocal).toEqual(false);
        expect(wrapper.vm.showRemote).toEqual(false);

        wrapper.vm.openCloseExpandMenu();
        expect(wrapper.vm.showLocal).toEqual(false);
        expect(wrapper.vm.showRemote).toEqual(true);

        wrapper.vm.openCloseExpandMenu();
        expect(wrapper.vm.showLocal).toEqual(false);
        expect(wrapper.vm.showRemote).toEqual(false);
      });
    });

    describe('Test hook function: onMounted', () => {
    });

    describe('Test hook function: onUnmounted', () => {
    });
  });
});
