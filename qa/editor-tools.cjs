exports.clickEditorTool = async (page, name) => {
 await page.locator('.sunaissu-document-toolbar').getByRole('button', { name, exact: true }).click();
};
