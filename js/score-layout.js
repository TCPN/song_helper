// abcjs 渲染後的版面修正：段落記號加框、統一每行譜的高度

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

// 除了最後一行，每行譜下方的空間取最大值，讓各行高度一致
export function fix_score_line_heights(selector){
  var score_paper = document.querySelector(selector);

  var needed_heights = line_needed_heights(score_paper);
  var bottoms = staff_bottoms(score_paper);
  var height_below_staff = needed_heights.map((h,i)=>(h - bottoms[i]));
  var max_height_below_staff = Math.max(...height_below_staff.slice(0, -1));
  var fixed_heights = bottoms.map(b=>(b + max_height_below_staff));
  set_line_height(line_svgs(score_paper).slice(0,-1), fixed_heights.slice(0,-1));
  // set_line_height(line_svgs(score_paper), fixed_heights);
  fix_line_styles(score_paper);
}
