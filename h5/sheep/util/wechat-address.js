// 只有匹配到完整区县才填 areaId；旧地区名称或缺失地区交给用户手选。
export function resolveWechatAddress(areas, address) {
  const find = (list, name) => Array.isArray(list)
    ? list.find((item) => item.name === name) : undefined;
  const province = find(areas, address.province_name);
  const city = find(province?.children, address.city_name);
  const district = find(city?.children, address.district_name)
    || find(province?.children, address.district_name);
  const matched = district && !(district.children?.length);
  return {
    name: address.consignee || '',
    mobile: address.mobile || '',
    detailAddress: address.address || '',
    defaultStatus: false,
    areaId: matched ? district.id : undefined,
    areaName: matched ? [address.province_name, address.city_name, address.district_name]
      .filter(Boolean).join(' ') : '',
  };
}
