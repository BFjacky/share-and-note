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
const markdownTitle = (activeLayer) => {
    let title = '##'
    let i = -1
    while(i<activeLayer){
        i++
        title+='#'
    }
    return title
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
            rootReadme += `${markdownTitle(layer)} ${rmFilenameSapce(getFileName(filepath))} \n`
            traversal(filepath, layer + 1)
        }else if(isMarkDown(filepath)){
            rootReadme += `${markdownTitle(layer+1)} [${rmFilenameSapce(getFileName(filepath))}](${transfer2RelativePath(filepath)}) \n`
        }
    }
    rootReadme += '\n'
}

traversal(Path.join(__dirname, './'), 0)

fs.writeFileSync(Path.join(__dirname,'./readme.md'),rootReadme)
