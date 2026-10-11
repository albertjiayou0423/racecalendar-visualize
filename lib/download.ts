/** Keep the link attached and its URL alive until the browser starts downloading. */
export function downloadFile(url: string, filename: string, revoke = false) {
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    link.remove()
    if (revoke) URL.revokeObjectURL(url)
  }, 60_000)
}
