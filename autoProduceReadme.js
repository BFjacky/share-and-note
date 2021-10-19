const fs = require('fs')
const Path = require('path')
const IGNORE_STAT_NAME = 'ignoreStat.txt'
const isDirectory = (path) => {
    const stats = fs.statSync(path)
    return stats.isDirectory()
}
const getFileName = (path) => {
    const arr = path.split('/')
    return arr[arr.length - 1]
}
const isMarkDown = (path) => {
    const filename = getFileName(path)
    const arr = filename.split('.')
    return arr[arr.length - 1] === 'md'
}
const markdownTitle = (activeLayer, isLink) => {
    let title = '##'
    let i = -1
    let prevSpace = ''
    while(i<activeLayer){
        i++
        title+='#'
        prevSpace += ''

    }
    if(isLink) title += '#'
    return title + prevSpace
}
const markdownIndex = (activeLayer, isLink) => {
    let index = '*'
    let i = -1
    let prevSpace = ''
    while(i<activeLayer){
        i++
        // prevSpace += '    '

    }
    // if(isLink) title += '#'
    return prevSpace + index
}
const transfer2RelativePath = (path) => {
    const startIdx = path.indexOf(__dirname)
    const endIdx = __dirname.length + startIdx
    const filepath = path.slice(0,startIdx) + path.slice(endIdx)
    const filepathWithoutSpace = Array.prototype.map.call(filepath,(char => char === ' ' ? '%20' : char)).join('')
    return filepathWithoutSpace
}
const rmFilenameSapce = (filename) => {
    return Array.prototype.filter.call(filename,(char => char !== ' ')).join('')
}
const getIgnoreList = (path) => {
    const rawTxt = fs.readFileSync(path,{encoding:'utf-8'})
    console.log(`get`,path,rawTxt)

    return rawTxt.split('\n')
}
const isIgnoreStatFile = (path) => {
    const filename = getFileName(path)
    return filename === IGNORE_STAT_NAME
}

let rootReadme = `# Share And Note \n\n`

const traversal = (subpath, layer = 0) => {
    const filenames = fs.readdirSync(subpath)
    const ignoreStatFile = filenames.find(filename => isIgnoreStatFile(filename))
    const ignoreList = ignoreStatFile ? getIgnoreList(Path.join(subpath, ignoreStatFile)) : []
    for(const filename of filenames){
        if(ignoreList.includes(filename)) continue
        const filepath = Path.join(subpath,`./${filename}`)
        if(isDirectory(filepath)){
            // TODO: add sub title when there are too many articles 
            if(layer === 0){
                rootReadme += `${markdownTitle(layer)} ${rmFilenameSapce(getFileName(filepath))} \n`
            }
            traversal(filepath, layer + 1)
        }else if(isMarkDown(filepath)){
            rootReadme += `${markdownIndex(layer, true)} [${rmFilenameSapce(getFileName(filepath))}](${transfer2RelativePath(filepath)}) \n`
        }
    }
    if(layer === 0){
        rootReadme += '\n'
    }
}

traversal(Path.join(__dirname, './'), 0)

fs.writeFileSync(Path.join(__dirname,'./readme.md'),rootReadme)
