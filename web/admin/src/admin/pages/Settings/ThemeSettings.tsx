import {useEffect, useState} from 'react';
import {Alert, App, Button, Card, Col, Image, Popconfirm, Row, Space, Spin, Tag, Typography, Upload} from 'antd';
import {Palette, ShieldAlert, Trash2, UploadCloud} from 'lucide-react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {activateTheme, deleteTheme, listThemes, type ThemeInfo, uploadTheme} from '@/api/theme';
import {getErrorMessage} from '@/lib/utils';

const {Text, Paragraph} = Typography;

const ThemePreview = ({theme}: {theme: ThemeInfo}) => {
    const [source, setSource] = useState<string>();
    useEffect(() => {
        const controller = new AbortController();
        let objectURL = '';
        const token = localStorage.getItem('token');
        fetch(theme.previewUrl, {
            signal: controller.signal,
            headers: token ? {Authorization: 'Bearer ' + token} : {},
        })
            .then((response) => response.ok ? response.blob() : Promise.reject())
            .then((blob) => {
                objectURL = URL.createObjectURL(blob);
                setSource(objectURL);
            })
            .catch(() => setSource(undefined));
        return () => {
            controller.abort();
            if (objectURL) URL.revokeObjectURL(objectURL);
        };
    }, [theme.id, theme.previewUrl]);
    return source
        ? <Image preview={false} src={source} className="!h-40 !w-full object-cover" alt={theme.name}/>
        : <div className="flex h-40 items-center justify-center bg-slate-100 dark:bg-slate-800"><Palette size={38}/></div>;
};

const ThemeSettings = () => {
    const {message, modal} = App.useApp();
    const queryClient = useQueryClient();
    const themesQuery = useQuery({queryKey: ['themes'], queryFn: listThemes});
    const refresh = () => queryClient.invalidateQueries({queryKey: ['themes']});
    const operation = useMutation({
        mutationFn: async (fn: () => Promise<unknown>) => fn(),
        onSuccess: async () => { message.success('操作成功'); await refresh(); },
        onError: (error) => message.error(getErrorMessage(error, '主题操作失败')),
    });

    const confirmUntrusted = (title: string, action: () => Promise<unknown>) => {
        modal.confirm({
            title,
            icon: <ShieldAlert className="text-amber-500"/>,
            width: 560,
            content: (
                <Alert className="mt-4" type="warning" showIcon
                       message="主题是同源可信代码"
                       description="主题包含可执行 JavaScript，能够访问此站点浏览器存储和公开 API。只安装并启用你完全信任的主题。"/>
            ),
            okText: '我信任此主题，继续',
            okButtonProps: {danger: true},
            onOk: () => operation.mutateAsync(action),
        });
    };

    const installedCards = (themesQuery.data || []).map((theme) => (
        <Col xs={24} md={12} xl={8} key={theme.id}>
            <Card className="h-full overflow-hidden" cover={<ThemePreview theme={theme}/>}
                  actions={[
                      theme.active ? <Tag color="success">当前主题</Tag> :
                          <Button type="link" disabled={!theme.compatible}
                                  onClick={() => confirmUntrusted('启用 ' + theme.name, () => activateTheme(theme.id))}>启用</Button>,
                      theme.official ? <Tag>内置</Tag> :
                          <Popconfirm title="确认删除主题？" description="主题文件删除后只能通过重新安装恢复。"
                                      disabled={theme.active}
                                      onConfirm={() => operation.mutateAsync(() => deleteTheme(theme.id))}>
                              <Button type="link" danger disabled={theme.active} icon={<Trash2 size={15}/>}>删除</Button>
                          </Popconfirm>,
                  ]}>
                <Card.Meta
                    title={<Space>{theme.name}<Tag>{theme.version}</Tag>{theme.official && <Tag color="blue">官方</Tag>}</Space>}
                    description={<>
                        <Paragraph ellipsis={{rows: 2}}>{theme.description || '暂无说明'}</Paragraph>
                        <Text type="secondary">作者：{theme.author}</Text>
                        {!theme.compatible && <Alert className="mt-3" type="error" showIcon message={theme.compatibilityError}/>}
                    </>}/>
            </Card>
        </Col>
    ));

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold">主题管理</h2>
                    <p className="mt-2 text-gray-500">安装和切换完整的公开页面主题；管理后台始终使用官方界面。</p>
                </div>
                <Upload accept=".zip,application/zip" showUploadList={false}
                        beforeUpload={(file) => {
                            confirmUntrusted('上传并安装 ' + file.name, () => uploadTheme(file as File));
                            return false;
                        }}>
                    <Button icon={<UploadCloud size={15}/>}>上传 ZIP</Button>
                </Upload>
            </div>
            <Alert className="mb-5" type="warning" showIcon message="安全提示"
                   description="第三方主题会在 Pika 同一域名下执行 JavaScript。主题不是沙箱，只安装你完全信任的来源。"/>
            {themesQuery.isLoading
                ? <div className="py-16 text-center"><Spin/></div>
                : <Row gutter={[16, 16]}>{installedCards}</Row>}
        </div>
    );
};

export default ThemeSettings;
