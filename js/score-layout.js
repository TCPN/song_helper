// abcjs 渲染後的版面修正：段落記號加框、設定每行譜的高度
import { line_heights } from './line-heights.js';

export function svg_elem_add_box(elem) {
  var bbox = elem.getBBox();
  var new_elem = document.createElement('rect');
  elem.insertAdjacentElement('afterend', new_elem);
  new_elem.outerHTML = `<rect x="${bbox.x - 1}" y="${bbox.y}" width="${bbox.width + 2}" height="${bbox.height}" stroke="#000000" stroke-width="0.5" fill="none"></rect>`;
  return new_elem;
}

function find_svg_needed_height(svg){
  var bottoms = Array.from(svg.children).map(elem=>{
    var bbox = elem.getBBox && elem.getBBox();
    return bbox && (bbox.y + bbox.height);
  }).filter(v=>v!=null);
  return Math.max(...bottoms);
}

function line_containers(score_paper){
  return Array.from(score_paper.querySelectorAll('.abcjs-container'));
}
function line_svgs(score_paper){
  return Array.from(score_paper.querySelectorAll('.abcjs-container svg'));
}
function staff_bottoms(score_paper){
  var staff_bottoms = line_svgs(score_paper).map((svg)=>{
    var staff_paths = Array.from(svg.querySelectorAll('.abcjs-top-line, .abcjs-top-line ~ .abcjs-staff'));
    return Math.max(...staff_paths.map(p=>(p.getBBox().y + p.getBBox().height)))
  });
  return staff_bottoms;
}
function line_needed_heights(score_paper){
  return line_svgs(score_paper).map(find_svg_needed_height);
}
function set_line_height(svgs, heights){
  svgs.forEach((svg,i)=>{
    if(heights[i] != null)
      svg.viewBox.baseVal.height = heights[i];
  })
}
function fix_line_styles(score_paper) {
  for(let line of line_containers(score_paper)){
    var svg = line.firstElementChild;
    svg.style.position = '';
    line.style.paddingBottom = '';
  }
}

// 每行 svg 的 viewBox 寬度
export function score_line_widths(selector){
  return line_svgs(document.querySelector(selector)).map((svg)=>svg.viewBox.baseVal.width);
}

// 每行 viewBox 的寬度都設成最寬那一行，各行縮放比例就一樣
export function fix_score_line_widths(selector){
  var svgs = line_svgs(document.querySelector(selector));
  var width = Math.max(...svgs.map((svg)=>svg.viewBox.baseVal.width));
  for(const svg of svgs)
    svg.viewBox.baseVal.width = width;
}

// 量測每行譜，再依 line_heights 設定高度；layout 是「排版」的設定（均等化、行距）。
// 只改 viewBox 高度、量的是元素本身的 bbox，所以改設定時對同一份譜再呼叫一次就好，不用重新渲染
export function fix_score_line_heights(selector, layout){
  var score_paper = document.querySelector(selector);

  var heights = line_heights(staff_bottoms(score_paper), line_needed_heights(score_paper), layout);
  set_line_height(line_svgs(score_paper), heights);
  fix_line_styles(score_paper);
}
