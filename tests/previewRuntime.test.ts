/**
 * The dev-preview fixture must stay usable: it is what `npm run dev` renders.
 */
import { describe, expect, it } from 'vitest';
import { createPreviewRuntime } from '../src/ui/lib/previewRuntime';

describe('preview runtime', () => {
  it('loads a representative fixture library', async () => {
    const rt = createPreviewRuntime();
    const state = await rt.getState();
    expect(state.status).toBe('ready');
    expect(state.repo?.skills.length).toBeGreaterThanOrEqual(10);
    const categories = state.repo!.tree.children.map((c) => c.name);
    expect(categories).toContain('Android');
    expect(categories).toContain('Web Development');
    expect(categories).toContain('Développement Web');
    expect(state.repo!.tree.totalSkills).toBe(state.repo!.skills.length);
  });

  it('serves content for every skill', async () => {
    const rt = createPreviewRuntime();
    const state = await rt.getState();
    for (const skill of state.repo!.skills) {
      const { content } = await rt.getSkillContent(skill.id);
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('```ts');
    }
  });

  it('supports selection, settings and refresh', async () => {
    const rt = createPreviewRuntime();
    const state = await rt.getState();
    const first = state.repo!.skills[0]!;
    const updated = await rt.setSelection({ ids: [first.id], allSelected: false });
    expect(updated.selection.ids).toEqual([first.id]);
    const cleared = await rt.clearSelection();
    expect(cleared.selection.ids).toEqual([]);

    const withLight = await rt.setSettings({ interface: { theme: 'light', compact: true } });
    expect(withLight.settings.interface.theme).toBe('light');

    const refreshed = await rt.refreshRepo();
    expect(refreshed.status).toBe('ready');
  });

  it('reports that LM Arena integration is unavailable in preview mode', async () => {
    const rt = createPreviewRuntime();
    await rt.getState();
    const report = (await rt.insertIntoArena()) as { outcome: string; failedStep: string };
    expect(report.outcome).toBe('failed');
    expect(report.failedStep).toBe('detect-tab');
  });
});
