const fs = require(`fs-extra`)
const grayMatter = require(`gray-matter`)
const crypto = require(`crypto`)
const _ = require(`lodash`)
const AdmZip = require('adm-zip')
const path = require(`path`)
const cheerio = require('cheerio')
const { createFileNode } = require(`gatsby-source-filesystem/create-file-node`)
const { createFilePath } = require(`gatsby-source-filesystem`)
const truncatise = require(`truncatise`)
const {replaceImages, transformImages} = require(`./replace-images`)
const Trianglify = require('trianglify')

const CACHE_DIR = `.cache`
const FS_PLUGIN_DIR = `gatsby-transformer-xsjzip`

const palettes = {
  YlGn: ["#ffffe5","#f7fcb9","#d9f0a3","#addd8e","#78c679","#41ab5d","#238443","#006837","#004529"],
  YlGnBu: ["#ffffd9","#edf8b1","#c7e9b4","#7fcdbb","#41b6c4","#1d91c0","#225ea8","#253494","#081d58"],
  GnBu: ["#f7fcf0","#e0f3db","#ccebc5","#a8ddb5","#7bccc4","#4eb3d3","#2b8cbe","#0868ac","#084081"],
  BuGn: ["#f7fcfd","#e5f5f9","#ccece6","#99d8c9","#66c2a4","#41ae76","#238b45","#006d2c","#00441b"],
  PuBuGn: ["#fff7fb","#ece2f0","#d0d1e6","#a6bddb","#67a9cf","#3690c0","#02818a","#016c59","#014636"],
  PuBu: ["#fff7fb","#ece7f2","#d0d1e6","#a6bddb","#74a9cf","#3690c0","#0570b0","#045a8d","#023858"],
  BuPu: ["#f7fcfd","#e0ecf4","#bfd3e6","#9ebcda","#8c96c6","#8c6bb1","#88419d","#810f7c","#4d004b"],
  RdPu: ["#fff7f3","#fde0dd","#fcc5c0","#fa9fb5","#f768a1","#dd3497","#ae017e","#7a0177","#49006a"],
  PuRd: ["#f7f4f9","#e7e1ef","#d4b9da","#c994c7","#df65b0","#e7298a","#ce1256","#980043","#67001f"],
  OrRd: ["#fff7ec","#fee8c8","#fdd49e","#fdbb84","#fc8d59","#ef6548","#d7301f","#b30000","#7f0000"],
  YlOrRd: ["#ffffcc","#ffeda0","#fed976","#feb24c","#fd8d3c","#fc4e2a","#e31a1c","#bd0026","#800026"],
  YlOrBr: ["#ffffe5","#fff7bc","#fee391","#fec44f","#fe9929","#ec7014","#cc4c02","#993404","#662506"],
  Purples: ["#fcfbfd","#efedf5","#dadaeb","#bcbddc","#9e9ac8","#807dba","#6a51a3","#54278f","#3f007d"],
  Blues: ["#f7fbff","#deebf7","#c6dbef","#9ecae1","#6baed6","#4292c6","#2171b5","#08519c","#08306b"],
  Greens: ["#f7fcf5","#e5f5e0","#c7e9c0","#a1d99b","#74c476","#41ab5d","#238b45","#006d2c","#00441b"],
  Oranges: ["#fff5eb","#fee6ce","#fdd0a2","#fdae6b","#fd8d3c","#f16913","#d94801","#a63603","#7f2704"],
  Reds: ["#fff5f0","#fee0d2","#fcbba1","#fc9272","#fb6a4a","#ef3b2c","#cb181d","#a50f15","#67000d"]
}

const slugs = {}

const fixSlugPath = (slug)=>{
  slug = slug.replace(/\.*/g, '')
  slug = slug.replace(/\/+/g, '/')
  slug = slug.replace(/^\/*|\/*$/g, '')
  return slug
}
const fixDuplateSlug = ({slug, times=0, reporter, node})=>{
  const orignSlug = slug
  if (!!times) {
    slug = slug + '_' + times
  }
  if (times > 20) {
    return slug = orignSlug + '_' + Date.now()
  }
  if (slugs[slug]) {
    reporter.warn(`重复的 slug ${slug}, ${node.absolutePath} 和 ${slugs[slug].absolutePath}`)
    return fixDuplateSlug({slug:orignSlug, times:times + 1, reporter, node})
  }
  return slug
}

const getTableOfContent = ($, slug)=>{
  const result = []
  let preItem = null
  let depth = 1
  $("h1, h2, h3, h4, h5, h6, h7").each((i, he)=>{
    const $he = $(he)
    if (!$he.hasClass("story_title")){
      let $anchorContainer = $he.find('.xsj_anchor')
      if ($anchorContainer.length == 0) {
        $anchorContainer = $he.prev()
      }
      const tagName = he.tagName
      const level = parseInt(tagName.substring(1))
      if ($anchorContainer.length === 1 && $anchorContainer.hasClass('xsj_anchor')){
        const nameEls = $anchorContainer.find(".blank_anchor_name")
        if (nameEls.length === 2) {
          const hash = nameEls[0].attribs.name
          const title = nameEls[1].attribs.name
          const link = `${slug}#${hash}`
          const item = {
            title,
            link,
          }
          if (depth < level) {
            if (preItem === null) {
              result.push(item)
            } else {
              depth += 1
              if (!preItem.items){
                preItem.items = []
              }
              item.parent = preItem
              preItem.items.push(item)
            }
          } else {
            while(depth != level) {
              if (!preItem) {
                depth = level
              } else {
                preItem = preItem.parent
                depth -= 1
              }
            }
            if (preItem && preItem.parent) {
              item.parent = preItem.parent
              preItem.parent.items.push(item)
            } else {
              result.push(item)
            }
          }
          preItem = item
        }
      }
    }
  })
  const removeParentField = (items)=>{
    items.forEach((item)=>{
      delete(item.parent)
      if (item.items) {
        removeParentField(item.items)
      }
    })
  }
  removeParentField(result)
  return result
}

module.exports = async function onCreateNode(
  { node, getNode, loadNodeContent, actions, createNodeId, reporter, store, pathPrefix, cache},
  pluginOptions
) {
  const { createNode, createParentChildLink } = actions
  const programDir = store.getState().program.directory
  const zzz = 0



  // We only care about markdown content.
  if (
    node.internal.mediaType !== `application/zip`
  ) {
    return
  }
  const zip = new AdmZip(node.absolutePath)
  const metaEntry = zip.getEntry("xiaoshujiang.json")
  if (!metaEntry){
    return
  }

  const targetDir = path.join(programDir, CACHE_DIR, FS_PLUGIN_DIR, node.relativeDirectory, node.name)
  zip.extractAllTo(targetDir, true)
  const metaContent = zip.readAsText("xiaoshujiang.json")
  const meta = JSON.parse(metaContent)
  const content = zip.readAsText(meta.main)
  const html = zip.readAsText(meta.main.replace(/\.md$/, '.html'))
  const $ = cheerio.load(html, {decodeEntities: false})
  const styles = []
  $('style').each((index, val)=>{
    const $style = $(val)
    styles.push($style.html())
  })
  const style = styles.join("\n")

  const fileResources = meta.fileResources || []
  const fileNodes = await Promise.all(_.map(fileResources, async (fileResource)=>{
      const fileResourcePath = path.join(targetDir, fileResource.filename)
      const fileNode = await createFileNode(fileResourcePath, createNodeId, {})
      fileNode.internal.description = `${node.internal.description} / ${fileResourcePath}`
      fileNode.parent = node.id
      createNode(fileNode, { name: `gatsby-source-filesystem` })
      createParentChildLink({ parent: node, child: fileNode })
      return fileNode
    })
  )
  const createJsonFileNode = async (meta)=>{
    const  jsonPath = path.join(targetDir, "xiaoshujiang.json")
    const fileNode = await createFileNode(jsonPath, createNodeId, {})
    fileNode.parent = node.id
    fileNode.internal.description = `${node.internal.description} / ${jsonPath}`
    createNode(fileNode, { name: `gatsby-source-filesystem` })
    createParentChildLink({ parent: node, child: fileNode })
    return fileNode
  }
  const jsonNode = await createJsonFileNode(meta)

  $('.story_title').remove()
  $('.story_tags').remove()
  $('#MathJax_SVG_glyphs').parent().css('display', 'none')
  $('#MathJax_SVG_glyphs').parent().parent().css('display', 'none')
  // 对 image 的特殊处理
  const remoteImageNodes = await transformImages({$, cache, store, createNode, createNodeId, parentNode:node, createParentChildLink})
  await replaceImages({$, jsonNode, cache, pathPrefix, reporter, fileNodes, remoteImageNodes})
  //const previewHtml = "<div id='xsj_root_html'><div id='xsj_root_body'>" + $('.html_preview.preview').parent().html() + "</div></div>"
  const previewHtml = $('.html_preview.preview').parent().html()

  try {
    let data = grayMatter(content, pluginOptions)
    const frontmatter = data.data
    // Convert date objects to string. Otherwise there's type mismatches
    // during inference as some dates are strings and others date objects.
    if (data.data) {
      data.data = _.mapValues(data.data, v => {
        if (_.isDate(v)) {
          return v.toJSON()
        } else {
          return v
        }
      })
      if (_.isArray(data.data.tags)){
        data.data.tags = data.data.tags.join(',')
      }
    }

    const xxId = createNodeId(`${jsonNode.id} >>> StoryWriterMarkdown`)
    const markdownNode = {
      id: xxId,
      children: [],
      parent: jsonNode.id,
      internal: {
        content: data.content,
        type: `StoryWriterMarkdown`,
      },
    }

    markdownNode.docType = node.sourceInstanceName? node.sourceInstanceName : `blogs`
    markdownNode.html = previewHtml
    markdownNode.zipPath = node.absolutePath
    markdownNode.title = frontmatter.title || meta.title
    markdownNode.tags = frontmatter.tags || meta.tags
    if (!!markdownNode.tags && typeof(markdownNode.tags) === 'string'){
      markdownNode.tags = markdownNode.tags.split(",")
    }
    markdownNode.customCss = meta.cssText
    markdownNode.css = style
    const slug = frontmatter.slug || meta.slug || createFilePath({node, getNode})
    markdownNode.slug = fixDuplateSlug({slug: fixSlugPath(slug), reporter, node})
    markdownNode.toc = JSON.stringify(getTableOfContent($, markdownNode.slug))
    slugs[markdownNode.slug] = node
    const stringfyDate = (date)=>{
      if (_.isDate(date)){
        date = date.getTime()
      }
      date = new Date(date).toJSON()
      return date
    }
    markdownNode.createDate = stringfyDate(frontmatter.createDate || meta.createDate || Date.now())
    markdownNode.updateDate = stringfyDate(frontmatter.updateDate || meta.updateDate || Date.now())
    markdownNode.cover = frontmatter.cover || meta.cover || null
    if (!!markdownNode.cover) {
      const cover = markdownNode.cover
      const imgReg = /!\[.*\]\((.*)\)/
      const imgMatch = cover.match(imgReg)
      if (imgMatch){
        markdownNode.cover = imgMatch[1]
      }
    }
    if (!markdownNode.cover){
      const fileCover = `cover.png`
      const fileCoverPath = path.join(targetDir, fileCover)
      if(!fs.existsSync(fileCoverPath)){
        reporter.info(`生成封面i${fileCoverPath}`)
        const pattern = Trianglify({
          palette: palettes,
          width: 1024,
          height: 768 
        })
        const pngURI = pattern.png()
        const pngData = pngURI.substr(pngURI.indexOf('base64') + 7)
        const pngBuffer = new Buffer(pngData, 'base64')
        fs.outputFileSync(fileCoverPath, pngBuffer)
      }
      const fileCoverNode = await createFileNode(fileCoverPath, createNodeId, {})
      fileCoverNode.internal.description = `${node.internal.description} / ${fileCoverPath}`
      fileCoverNode.parent = node.id
      createNode(fileCoverNode, { name: `gatsby-source-filesystem` })
      createParentChildLink({ parent: node, child: fileCoverNode })
      markdownNode.cover = `./${fileCover}`
    }
    const pFragments = []
    $('.html_preview.preview>p').each((i, p)=>{
      pFragments.push($(p).html())
    })

    markdownNode.excerpt = frontmatter.excerpt || meta.excerpt || truncatise(pFragments.join("\n"), {
      TruncateBy: "characters",
      TruncateLength: 140,
      StripHTML: true,
      Strict: true
    })
    markdownNode.meta = {
      title: ``, // always include a title
      ...data.data,
    }

    markdownNode.rawMarkdownBody = data.content

    // Add path to the markdown file path
    if (jsonNode.internal.type === `File`) {
      markdownNode.fileAbsolutePath = jsonNode.absolutePath
    }

    markdownNode.internal.contentDigest = crypto
      .createHash(`md5`)
      .update(JSON.stringify(markdownNode))
      .digest(`hex`)

    createNode(markdownNode)
    createParentChildLink({ parent: jsonNode, child: markdownNode })
  } catch (err) {
    reporter.panicOnBuild(
      `Error processing Markdown ${
        jsonNode.absolutePath ? `file ${jsonNode.absolutePath}` : `in node ${jsonNode.id}`
      }:\n
      ${err.message}`
    )
  }
}
