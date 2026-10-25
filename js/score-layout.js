// abcjs 渲染後的版面修正：段落記號加框、反覆框去重、設定每行譜的高度
import { line_heights } from './line-heights.js';
import { duplicate_endings, fit_inside } from './score-marks.js';

export function svg_elem_add_box(elem) {
  var bbox = elem.getBBox();
  var new_elem = document.createElement('rect');
  elem.insertAdjacentElement('afterend', new_elem);
  new_elem.outerHTML = `<rect x="${bbox.x - 1}" y="${bbox.y}" width="${bbox.width + 2}" height="${bbox.height}" stroke="#000000" stroke-width="0.5" fill="none"></rect>`;
  return new_elem;
}

// 段落記號（.abcjs-part）不超出譜的左右邊界（#69），再加框；框比字左右各寬 1
export function fix_part_marks(selector){
  for(const svg of line_svgs(document.querySelector(selector))){
    // 找不到譜線時只加框、不移
    var staff = svg.querySelector('.abcjs-top-line');
    var staff_box = staff && staff.getBBox();
    for(const part of svg.querySelectorAll('.abcjs-part')){
      var box = part.getBBox();
      var dx = staff_box ? fit_inside({ left: box.x - 1, right: box.x + box.width + 1 },
        { left: staff_box.x, right: staff_box.x + staff_box.width }) : 0;
      // abcjs 的 <text> 和裡面的 <tspan> 都有 x
      if(dx)
        for(const elem of [part, ...part.querySelectorAll('tspan')])
          if(elem.hasAttribute('x'))
            elem.setAttribute('x', Number(elem.getAttribute('x')) + dx);
      svg_elem_add_box(part);
    }
  }
}

// abcjs 畫一個反覆框依序是：開頭的直線與字（有開頭時）、結尾的直線（有結尾時）、最後是上面的橫線。
// 依聲部把 .abcjs-ending 分成一個個框，移除和前面聲部重複的框（#64）
export function remove_duplicate_endings(selector){
  for(const svg of line_svgs(document.querySelector(selector))){
    var endings = [];
    var pending = {};
    for(const elem of svg.querySelectorAll('.abcjs-ending')){
      var voice = Number((elem.getAttribute('class').match(/abcjs-v(\d+)/) || [0, 0])[1]);
      // 同一個聲部還沒等到橫線就又出現字，表示前一個框不完整：丟掉不處理（只去重完整的框）
      if(elem.tagName == 'text' && pending[voice] && pending[voice].label)
        delete pending[voice];
      var ending = pending[voice] || (pending[voice] = { voice, label: '', elems: [] });
      ending.elems.push(elem);
      if(elem.tagName == 'text')
        ending.label = elem.textContent;
      else{
        var box = elem.getBBox();
        if(box.height == 0 && box.width > 0){
          ending.x1 = box.x;
          ending.x2 = box.x + box.width;
          endings.push(ending);
          delete pending[voice];
        }
      }
    }
    for(const i of duplicate_endings(endings))
      endings[i].elems.forEach((elem)=>elem.remove());
  }
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
  // 分頁時藏起來的行（score-pages.js）量不到 bbox，先全部顯示；之後重新分頁時再藏起來
  for(const line of line_containers(score_paper))
    line.classList.remove('off-page');

  var heights = line_heights(staff_bottoms(score_paper), line_needed_heights(score_paper), layout);
  set_line_height(line_svgs(score_paper), heights);
  fix_line_styles(score_paper);
}
