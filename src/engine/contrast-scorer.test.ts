import { expect, it } from 'vitest';
import { colorIdentity, contrast, createContrastScorer, isSrgb, parseLockedColor, toColor } from './color';
it('matches direct contrast scoring across colors, exact sources and distinct constraints',()=>{
  const white=toColor('#fff'),black=toColor('#000');
  const sets=[[],[{background:white,target:4.5}],[{background:white,target:4.5},{background:black,target:3}],
    [{background:white,target:1,distinct:true}],[{background:parseLockedColor('oklch(.6 .4 29)'),target:3}]];
  const colors=[white,black,parseLockedColor('#fff'),parseLockedColor('oklch(.6 .4 29)'),...Array.from({length:101},(_,i)=>toColor({l:i/100,c:.15,h:29}))];
  for(const constraints of sets){
    const score=createContrastScorer(constraints);
    for(const c of colors){
      const expected=!isSrgb(c)?0:Math.min(Infinity,...constraints.map(({background,target,...rest})=>isSrgb(background)&&(!('distinct' in rest&&rest.distinct)||colorIdentity(c)!==colorIdentity(background))?contrast(c,background)/target:0));
      expect(score(c)).toBe(expected);
    }
  }
});
it('reads the current candidate CSS rather than stale object coordinates',()=>{
  const color=toColor('#fff');const score=createContrastScorer([{background:toColor('#000'),target:3}]);
  expect(score(color)).toBeCloseTo(7,12);color.css='#000';expect(score(color)).toBe(1/3);
});
