// @vitest-environment happy-dom
import { flushSync, mount, tick, unmount } from 'svelte';
import { expect, it } from 'vitest';
import reference from 'virtual:kds-reference';
import { defaultConfiguration } from './defaultConfiguration';
import { generateSystem } from '../engine/generate';
import ThemePreview from './ThemePreview.svelte';

it.each(['light','dark'] as const)('shows working component examples at every %s surface level',async mode=>{
 const config=defaultConfiguration(reference);config.surfaces.levels=3;
 const system=generateSystem(config);
 const c=mount(ThemePreview,{target:document.body,props:{system,mode}});flushSync();
 try{
  expect(document.querySelectorAll('[data-example="same-surface-card"]')).toHaveLength(3);
  expect(document.querySelectorAll('[data-example="next-surface-card"]')).toHaveLength(2);
  expect(document.querySelectorAll('.surface-examples input[type="text"]')).toHaveLength(3);
  expect(document.querySelectorAll('.surface-examples input[type="checkbox"]')).toHaveLength(3);
  const input=document.querySelector<HTMLInputElement>('.surface-examples input[type="text"]')!;
  input.value='Changed project';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
  expect(input.value).toBe('Changed project');
  const row=document.querySelector<HTMLInputElement>('.surface-examples input[type="checkbox"]')!;
  row.click();await tick();expect(row.checked).toBe(true);
  expect(row.closest('.example-selectable-row')!.getAttribute('data-checked')).toBe('true');
  const toggle=[...document.querySelectorAll('button')].find(b=>b.textContent==='Show states')!;
  expect(document.querySelector('.example-state-grid')).toBeNull();
  toggle.click();await tick();flushSync();
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  expect(document.querySelectorAll('.example-state-grid')).toHaveLength(6);
  expect(document.querySelector('[data-example-state="focus"]')).not.toBeNull();
  expect(input.value).toBe('Changed project');
  toggle.click();await tick();expect(document.querySelector('.example-state-grid')).toBeNull();
 }finally{await unmount(c);document.body.replaceChildren();}
});
